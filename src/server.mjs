import { createServer } from 'node:http';
import { compactContext, publicSources, searchCatalog, catalogStats } from './catalog.mjs';
import { streamOpenAIResponse, parseOpenAIStream } from './openai.mjs';
import { buildInput, SYSTEM_INSTRUCTIONS } from './prompt.mjs';

const port = Number(process.env.PORT || 8787);
const apiKey = process.env.OPENAI_API_KEY || '';
const model = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
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
      model,
      catalog_products: catalogStats.products,
      catalog_generated_at: catalogStats.generatedAt,
      api_key_configured: Boolean(apiKey)
    });
  }

  if (request.method !== 'POST' || url.pathname !== '/api/adviser') {
    return sendJson(response, 404, { error: 'Route introuvable' });
  }
  if (origin && !allowedOrigins.has(origin)) return sendJson(response, 403, { error: 'Origine refusée' });
  if (!apiKey) return sendJson(response, 503, { error: 'OPENAI_API_KEY non configurée' }, cors);
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
  const searchQuery = [...history.filter((item) => item.role === 'user').slice(-3).map((item) => item.content), message].join(' ');
  const matches = searchCatalog(searchQuery, 8);
  const sources = publicSources(matches, shopBaseUrl);
  const input = buildInput({
    message,
    history,
    catalogContext: compactContext(matches),
    pageUrl: typeof body.page_url === 'string' ? body.page_url.slice(0, 500) : ''
  });

  response.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff',
    ...cors
  });
  response.write(`${JSON.stringify({ type: 'sources', items: sources })}\n`);

  const abortController = new AbortController();
  request.on('aborted', () => abortController.abort());
  response.on('close', () => {
    if (!response.writableEnded) abortController.abort();
  });

  try {
    const stream = await streamOpenAIResponse({
      apiKey,
      model,
      instructions: SYSTEM_INSTRUCTIONS,
      input,
      signal: abortController.signal
    });

    for await (const event of parseOpenAIStream(stream)) {
      response.write(`${JSON.stringify(event)}\n`);
    }
    response.write(`${JSON.stringify({ type: 'done' })}\n`);
    response.end();
  } catch (error) {
    if (!response.writableEnded) {
      response.write(`${JSON.stringify({ type: 'error', message: 'Le conseiller est momentanément indisponible.' })}\n`);
      response.end();
    }
    console.error(error);
  }
});

server.listen(port, () => {
  console.log(`Conseiller CLASS'CLOPE démarré sur http://localhost:${port}`);
});
