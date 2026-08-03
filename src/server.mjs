import { createServer } from 'node:http';
import {
  compactContext,
  confidentProductAnswer,
  hasConfidentMatch,
  hasRelevantMatch,
  publicSources,
  searchCatalog,
  searchProducts,
  mergeCatalogProducts,
  catalogStats,
  productCards,
  verifyCompatibility
} from './catalog.mjs';
import { streamOpenAIResponse, parseOpenAIStream } from './openai.mjs';
import { buildInput, SYSTEM_INSTRUCTIONS } from './prompt.mjs';
import { enrichCardsFromShopify, getLiveCatalog, searchLiveCatalog } from './shopify.mjs';
import { diyCalculationResponse } from './calculator.mjs';
import { knowledgeResponse, knowledgeStats } from './knowledge.mjs';
import {
  conversationIntent,
  conversationState,
  assistantConfigurationResponse,
  complianceResponse,
  guidedQuestion,
  healthResponse,
  needsHuman,
  orderSupport,
  safetyResponse,
  securityResponse,
  searchFeedbackResponse,
  shouldShowCatalogSources,
  shouldShowProductCards,
  troubleshootingResponse
} from './guidance.mjs';

const port = Number(process.env.PORT || 8787);
const apiKey = process.env.OPENAI_API_KEY || '';
const model = process.env.OPENAI_MODEL || 'gpt-5.6-sol';
const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || 'medium';
const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 1100);
const shopBaseUrl = process.env.SHOP_BASE_URL || 'https://www.classclope.fr';
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://www.classclope.fr,https://classclope.fr')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const maxRequests = Number(process.env.MAX_REQUESTS_PER_5_MINUTES || 25);
const rateWindowMs = 5 * 60 * 1000;
const rateBuckets = new Map();
const metrics = { conversations: 0, errors: 0, recommendations: 0, human_transfers: 0, product_clicks: 0, add_to_cart: 0 };
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 25_000);
const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - rateWindowMs;
  for (const [key, bucket] of rateBuckets) if (bucket.startedAt < cutoff) rateBuckets.delete(key);
}, rateWindowMs);
cleanupTimer.unref();

function remoteAddress(request) {
  return (
    request.headers['cf-connecting-ip'] ||
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    request.socket.remoteAddress ||
    'unknown'
  );
}

function consumeRateLimit(key) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= rateWindowMs) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= maxRequests;
}

function corsHeaders(origin) {
  if (!origin || !allowedOrigins.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(JSON.stringify(body));
}

async function readJson(request, maxBytes = 40_000) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  }
  return JSON.parse(raw || '{}');
}

function validHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-12)
    .filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .map((item) => ({ role: item.role, content: item.content.slice(0, 1600) }));
}

function safePageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const parsed = new URL(value, shopBaseUrl);
    const shop = new URL(shopBaseUrl);
    if (parsed.origin !== shop.origin) return '';
    return `${parsed.origin}${parsed.pathname}`.slice(0, 1000);
  } catch {
    return '';
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const origin = request.headers.origin || '';
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) return sendJson(response, 403, { error: 'Origine refusée' });
    response.writeHead(204, cors);
    return response.end();
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    return sendJson(response, 200, {
      ok: true,
      version: '3.1.0-expert-fiable',
      model,
      catalog_products: catalogStats.products,
      catalog_generated_at: catalogStats.generatedAt,
      knowledge_entries: knowledgeStats.entries,
      knowledge_version: knowledgeStats.version,
      api_key_configured: Boolean(apiKey)
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/events') {
    if (origin && !allowedOrigins.has(origin)) return sendJson(response, 403, { error: 'Origine refusée' });
    try {
      const event = await readJson(request, 2_000);
      if (['conversations', 'errors', 'recommendations', 'human_transfers', 'product_clicks', 'add_to_cart'].includes(event.type)) {
        metrics[event.type] += 1;
      }
      return sendJson(response, 202, { ok: true }, cors);
    } catch {
      return sendJson(response, 400, { error: 'Événement invalide' }, cors);
    }
  }

  if (request.method !== 'POST' || url.pathname !== '/api/adviser') {
    return sendJson(response, 404, { error: 'Route introuvable' });
  }
  if (origin && !allowedOrigins.has(origin)) return sendJson(response, 403, { error: 'Origine refusée' });
  if (!consumeRateLimit(remoteAddress(request))) {
    return sendJson(response, 429, { error: 'Trop de demandes. Réessayez dans quelques minutes.' }, cors);
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    const status = error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
    return sendJson(response, status, { error: 'Requête invalide' }, cors);
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 700) : '';
  if (!message) return sendJson(response, 400, { error: 'Question manquante' }, cors);

  const history = validHistory(body.history);
  const knowledge = knowledgeResponse(message, shopBaseUrl);
  const calculation = diyCalculationResponse(message, shopBaseUrl);
  const safety = safetyResponse(message);
  const health = healthResponse(message);
  const compliance = complianceResponse(message);
  const security = securityResponse(message);
  const order = knowledge ? null : orderSupport(message, shopBaseUrl);
  const configurationHelp = assistantConfigurationResponse(message);
  const troubleshooting = troubleshootingResponse(message);
  const deterministic = safety || health || compliance || security || calculation || knowledge || order || (troubleshooting ? { text: troubleshooting } : null) || (configurationHelp ? { text: configurationHelp } : null);
  const currentMatches = deterministic ? [] : searchCatalog(message, 8);
  let intent = conversationIntent(message, history, currentMatches);
  const previousUserMessages = history.filter((item) => item.role === 'user').slice(-2).map((item) => item.content);
  const currentStandaloneIntent = conversationIntent(message, [], currentMatches);
  const continuation = currentStandaloneIntent === 'information' && intent !== 'information';
  const searchQuery = intent === 'search_feedback'
    ? previousUserMessages.join(' ')
    : (continuation ? [...previousUserMessages, message].join(' ') : message);
  let matches = hasConfidentMatch(currentMatches) ? currentMatches : searchCatalog(searchQuery, 8);
  const catalogRelevant = !deterministic && (['recommendation', 'compatibility', 'search_feedback'].includes(intent) || (intent === 'information' && hasRelevantMatch(currentMatches)));
  const requiresLiveComparison = intent === 'recommendation' && /\b(moins cher|prix|budget|plus puissant|puissance|autonomie|meilleur rapport)\b/i.test(message);
  if (catalogRelevant && !requiresLiveComparison && !hasConfidentMatch(matches)) {
    const suggestAbort = new AbortController();
    const suggestTimeout = setTimeout(() => suggestAbort.abort(new Error('SHOPIFY_SUGGEST_TIMEOUT')), 3_000);
    try {
      const suggestedProducts = await searchLiveCatalog(searchQuery, shopBaseUrl, suggestAbort.signal);
      const suggestedMatches = searchProducts(searchQuery, mergeCatalogProducts(suggestedProducts), 8);
      if (hasConfidentMatch(suggestedMatches) || Number(suggestedMatches[0]?._score || 0) > Number(matches[0]?._score || 0)) {
        matches = suggestedMatches;
      }
    } catch {
      // La seconde recherche complète reste disponible.
    } finally {
      clearTimeout(suggestTimeout);
    }
  }
  if (catalogRelevant && (requiresLiveComparison || !hasConfidentMatch(matches))) {
    const liveAbort = new AbortController();
    const liveTimeout = setTimeout(() => liveAbort.abort(new Error('LIVE_CATALOG_TIMEOUT')), 7_000);
    try {
      const liveProducts = await getLiveCatalog(shopBaseUrl, liveAbort.signal);
      const liveMatches = searchProducts(searchQuery, mergeCatalogProducts(liveProducts), 8);
      if (hasConfidentMatch(liveMatches) || Number(liveMatches[0]?._score || 0) > Number(matches[0]?._score || 0)) matches = liveMatches;
    } catch {
      // Le catalogue embarqué reste disponible si Shopify répond trop lentement.
    } finally {
      clearTimeout(liveTimeout);
    }
  }
  intent = conversationIntent(message, history, matches);
  const compatibility = verifyCompatibility(searchQuery, matches);
  const guide = guidedQuestion(message, history, matches);
  const searchFeedback = searchFeedbackResponse(message, matches);
  const directAnswer = intent === 'recommendation' ? confidentProductAnswer(matches, searchQuery) : null;
  const sources = intent === 'compatibility' && compatibility.status === 'verified'
    ? [...new Map(compatibility.evidence.map((item) => [item.url, {
      title: item.product,
      url: new URL(item.url, shopBaseUrl).toString(),
      detail: item.statement
    }])).values()].slice(0, 4)
    : publicSources(matches, shopBaseUrl);
  const human = needsHuman(message, compatibility, intent);
  let prefetchedCards = [];
  if (intent === 'recommendation' && hasRelevantMatch(matches) && /\b(moins cher|prix|budget|plus puissant|puissance|autonomie|meilleur rapport)\b/i.test(message)) {
    const cardAbort = new AbortController();
    const cardTimeout = setTimeout(() => cardAbort.abort(new Error('COMPARISON_CARD_TIMEOUT')), 5_000);
    try {
      prefetchedCards = (await enrichCardsFromShopify(productCards(matches, shopBaseUrl), shopBaseUrl, cardAbort.signal))
        .filter((card) => card.available !== false);
    } finally {
      clearTimeout(cardTimeout);
    }
  }
  metrics.conversations += history.length ? 0 : 1;

  response.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff',
    ...cors
  });

  response.write(`${JSON.stringify({ type: 'verification', compatibility, human, intent })}\n`);

  if (deterministic) {
    response.write(`${JSON.stringify({ type: 'delta', delta: deterministic.text || deterministic })}\n`);
    if (deterministic.link) response.write(`${JSON.stringify({ type: 'sources', items: [deterministic.link] })}\n`);
    if (human) {
      metrics.human_transfers += 1;
      response.write(`${JSON.stringify({ type: 'human', url: new URL('/pages/contact', shopBaseUrl).toString() })}\n`);
    }
    response.write(`${JSON.stringify({ type: 'done' })}\n`);
    return response.end();
  }

  if (searchFeedback || directAnswer) {
    const answer = searchFeedback || directAnswer;
    if (hasConfidentMatch(matches)) {
      response.write(`${JSON.stringify({ type: 'sources', items: publicSources(matches.slice(0, 1), shopBaseUrl) })}\n`);
    }
    response.write(`${JSON.stringify({ type: 'delta', delta: answer })}\n`);
    if (hasConfidentMatch(matches)) {
      const cardAbort = new AbortController();
      const cardTimeout = setTimeout(() => cardAbort.abort(new Error('PRODUCT_CARD_TIMEOUT')), 5_000);
      try {
        const cards = await enrichCardsFromShopify(productCards(matches.slice(0, 1), shopBaseUrl, 1), shopBaseUrl, cardAbort.signal);
        if (cards.length) {
          metrics.recommendations += cards.length;
          response.write(`${JSON.stringify({ type: 'products', items: cards })}\n`);
        }
      } finally {
        clearTimeout(cardTimeout);
      }
    }
    response.write(`${JSON.stringify({ type: 'done' })}\n`);
    return response.end();
  }

  if (guide) {
    response.write(`${JSON.stringify({ type: 'delta', delta: guide.text })}\n`);
    response.write(`${JSON.stringify({ type: 'choices', items: guide.choices })}\n`);
    response.write(`${JSON.stringify({ type: 'done' })}\n`);
    return response.end();
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(new Error('REQUEST_TIMEOUT')), requestTimeoutMs);
  request.on('aborted', () => abortController.abort());
  response.on('close', () => {
    if (!response.writableEnded) abortController.abort();
  });

  if (human) {
    metrics.human_transfers += 1;
    response.write(`${JSON.stringify({ type: 'human', url: new URL('/pages/contact', shopBaseUrl).toString() })}\n`);
  }
  const input = buildInput({
    message,
    history,
    catalogContext: compactContext(hasRelevantMatch(matches) ? matches : []),
    liveProducts: prefetchedCards.map((card) => ({
      title: card.title,
      prix: card.price,
      disponible: card.available,
      puissance: card.features?.find((value) => /\bw\b/i.test(value)) || '',
      url: card.url
    })),
    pageUrl: safePageUrl(body.page_url),
    compatibility,
    intent,
    conversationState: conversationState(message, history),
    knowledgeContext: null
  });
  if (shouldShowCatalogSources(intent) && hasRelevantMatch(matches)) {
    response.write(`${JSON.stringify({ type: 'sources', items: sources })}\n`);
  }

  if (!apiKey) {
    response.write(`${JSON.stringify({ type: 'error', message: "Le conseiller conversationnel est temporairement indisponible. Les réponses de sécurité, de livraison et les recherches produit certaines restent accessibles." })}\n`);
    return response.end();
  }

  try {
    const stream = await streamOpenAIResponse({
      apiKey,
      model,
      instructions: SYSTEM_INSTRUCTIONS,
      input,
      signal: abortController.signal,
      reasoningEffort,
      maxOutputTokens
    });

    for await (const event of parseOpenAIStream(stream)) {
      response.write(`${JSON.stringify(event)}\n`);
    }
    if (shouldShowProductCards(intent, message, matches, compatibility)) {
      const cards = prefetchedCards.length
        ? prefetchedCards
        : await enrichCardsFromShopify(productCards(matches, shopBaseUrl), shopBaseUrl, abortController.signal);
      const availableCards = cards.filter((card) => card.available !== false).slice(0, 3);
      if (availableCards.length) {
        metrics.recommendations += availableCards.length;
        response.write(`${JSON.stringify({ type: 'products', items: availableCards })}\n`);
      }
    }
    response.write(`${JSON.stringify({ type: 'done' })}\n`);
    response.end();
  } catch (error) {
    metrics.errors += 1;
    if (!response.writableEnded) {
      response.write(`${JSON.stringify({ type: 'error', message: "Je rencontre un délai technique. Vous pouvez réessayer ou utiliser « Parler à un conseiller »." })}\n`);
      response.end();
    }
    console.error(error);
  } finally {
    clearTimeout(timeout);
  }
});

server.listen(port, () => {
  console.log(`Conseiller CLASS'CLOPE démarré sur http://localhost:${port}`);
  const warmAbort = new AbortController();
  const warmTimeout = setTimeout(() => warmAbort.abort(new Error('CATALOG_WARMUP_TIMEOUT')), 7_000);
  void getLiveCatalog(shopBaseUrl, warmAbort.signal)
    .catch(() => {})
    .finally(() => clearTimeout(warmTimeout));
});
