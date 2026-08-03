import catalogFile from '../data/catalog.json' with { type: 'json' };

const STOP_WORDS = new Set([
  'a', 'ai', 'avec', 'avez', 'avoir', 'base', 'besoin', 'boite', 'boîte', 'chez', 'choisir',
  'comment', 'conseil', 'dans', 'de', 'des', 'du', 'elle', 'elles', 'en', 'est', 'et', 'faire',
  'faut', 'feve', 'fève', 'je', 'la', 'le', 'les', 'liquide', 'liquides', 'e-liquide', 'e-liquides',
  'ma', 'mes', 'mon', 'pour', 'quelle', 'quelles', 'quel', 'quels', 'recherche', 'rechercher',
  'trouve', 'trouver', 'un', 'une', 'valeur', 'vape', 'veux', 'voudrais', 'vous', 'gout', 'goût',
  'saveur', 'saveurs', 'moins', 'cher', 'chere', 'chères', 'prix', 'budget', 'plus', 'puissant',
  'puissante', 'puissance', 'autonomie', 'meilleur', 'meilleure', 'rapport', 'pod', 'pods', 'kit',
  'puff', 'puffs', 'cartouche', 'cartouches', 'resistance', 'resistances', 'coil', 'materiel'
]);

const FIELD_WEIGHTS = Object.freeze({
  title: 34,
  vendor: 18,
  flavor: 72,
  compatibility: 48,
  cartridges: 48,
  variants: 28,
  tags: 22,
  type: 18,
  structured: 18,
  description: 12
});
const NO_FUZZY_TOKENS = new Set(['fruite', 'frais', 'fraiche', 'classic', 'gourmand', 'menthe', 'menthol', 'tabac']);

export function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\bxross\b/g, 'xros')
    .replace(/\bemerald\b/g, 'emrald')
    .replace(/\bemral\b/g, 'emrald')
    .replace(/\bxrmax\b/g, 'xr max')
    .replace(/\bgeek vape\b/g, 'geekvape')
    .replace(/\bvapo resso\b/g, 'vaporesso')
    .replace(/\se\sliquides?\b/g, ' eliquide')
    .replace(/\s+/g, ' ')
    .trim();
}

function rawTokens(value) {
  return normalize(value).split(' ').filter((token) => token.length > 1);
}

function queryTokens(value) {
  return [...new Set(rawTokens(value).filter((token) => !STOP_WORDS.has(token)))];
}

function tokenSet(value) {
  return new Set(rawTokens(value));
}

export function requestedProductFamily(query) {
  const text = normalize(query);
  if (/\b(cartouche|cartridge)\b/.test(text)) return 'cartouche';
  if (/\b\d+(?:[.,]\d+)?\s*ohm\b/.test(text) && /\bpod\b/.test(text)) return 'cartouche';
  if (/\b(resistance|coil)\b/.test(text)) return 'resistance';
  if (/\b(concentre|arome diy)\b/.test(text)) return 'concentre';
  if (/\b(e liquide|eliquide|liquide)\b/.test(text)) return 'liquide';
  if (/\bpuffs?\b/.test(text)) return 'puff';
  if (/\bpod\b/.test(text)) return 'pod';
  if (/\b(kit|cigarette electronique|materiel)\b/.test(text)) return 'materiel';
  return '';
}

function belongsToFamily(product, family) {
  const type = normalize(product.type);
  const title = normalize(product.title);
  if (family === 'cartouche') return type.includes('cartouche') || title.startsWith('cartouche');
  if (family === 'resistance') return type.includes('resistance') || title.startsWith('resistance');
  if (family === 'concentre') return type.includes('concentre') || title.includes('concentre');
  if (family === 'liquide') return !/\b(cartouche|resistance|materiel|accessoire|concentre|arome|base|booster)\b/.test(type) && Boolean(product.flavor || /\b10ml|50ml|100ml|liquide\b/.test(`${type} ${title}`));
  if (family === 'puff') return /\bpuffs?\b/.test(`${type} ${title} ${normalize(product.tags)}`);
  if (family === 'pod') {
    if (type === 'pods') return true;
    if (!type.includes('materiel')) return false;
    if (/\bbox\b|\bkit aegis\b|\bkit coolfire\b/.test(title)) return false;
    return !/clearomiseur/.test(normalize(product.cartridges));
  }
  if (family === 'materiel') return type.includes('materiel') || /\bkit\b/.test(title);
  return true;
}

function minimumPrice(product) {
  const prices = (product.variants || []).map((variant) => Number(String(variant.price || '').replace(',', '.'))).filter((price) => Number.isFinite(price) && price >= 0);
  return prices.length ? Math.min(...prices) : null;
}

function maximumNumber(value, unit) {
  const matches = [...normalize(value).matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, 'g'))].map((match) => Number(match[1]));
  return matches.length ? Math.max(...matches) : null;
}

function comparisonCriteria(query) {
  const text = normalize(query);
  return {
    price: /\b(moins cher|prix|budget|economique|pas cher)\b/.test(text),
    power: /\b(plus puissant|puissance|puissant)\b/.test(text),
    autonomy: /\b(autonomie|batterie|mah)\b/.test(text),
    budget: Number(text.match(/(?:moins de|maximum|max|budget(?: de)?)\s*(\d+(?:\.\d+)?)(?:\s*euros?)?/i)?.[1] || NaN)
  };
}

function applyPreferences(ranked, query) {
  const text = normalize(query);
  if (/\b(sans frais|pas frais|non frais|sans menthol|pas menthole)\b/.test(text)) {
    const nonFresh = ranked.filter((entry) => !/\b(frais|fraiche|fresh|ice|glace|frappe|menthol)\b/.test(entry.normalizedSearch));
    if (nonFresh.length) ranked = nonFresh;
  }
  const nicotine = text.match(/\b(0|3|6|10|11|12|18|20)\s*mg(?:\s*\/\s*ml)?\b/)?.[1];
  if (nicotine !== undefined) {
    const exactNicotine = ranked.filter(({ product }) => {
      const variants = normalize((product.variants || []).map((variant) => variant.option).join(' '));
      if (new RegExp(`\\b${nicotine}\\s*mg\\b`).test(variants)) return true;
      return nicotine === '0' && /\b(50ml|60ml|100ml)\b/.test(normalize(`${product.type} ${product.title}`));
    });
    if (exactNicotine.length) ranked = exactNicotine;
  }
  const criteria = comparisonCriteria(query);
  if (Number.isFinite(criteria.budget)) {
    const inBudget = ranked.filter(({ product }) => {
      const price = minimumPrice(product);
      return price !== null && price <= criteria.budget;
    });
    if (inBudget.length) ranked = inBudget;
  }
  if (!criteria.price && !criteria.power && !criteria.autonomy) return ranked;

  const enriched = ranked.map((entry) => ({
    ...entry,
    price: minimumPrice(entry.product),
    power: maximumNumber(entry.product.power, 'w'),
    autonomy: maximumNumber(`${entry.product.key_points} ${entry.product.description}`, 'mah')
  }));
  const values = (field) => enriched.map((entry) => entry[field]).filter((value) => Number.isFinite(value));
  const range = (field) => {
    const list = values(field);
    return { min: list.length ? Math.min(...list) : 0, max: list.length ? Math.max(...list) : 0 };
  };
  const priceRange = range('price');
  const powerRange = range('power');
  const autonomyRange = range('autonomy');
  const normalizedValue = (value, valueRange, inverse = false) => {
    if (!Number.isFinite(value)) return 0;
    if (valueRange.max === valueRange.min) return 1;
    const ratio = (value - valueRange.min) / (valueRange.max - valueRange.min);
    return inverse ? 1 - ratio : ratio;
  };
  const criteriaCount = Number(criteria.price) + Number(criteria.power) + Number(criteria.autonomy);
  return enriched.map((entry) => {
    let utility = 0;
    if (criteria.price) utility += normalizedValue(entry.price, priceRange, true);
    if (criteria.power) utility += normalizedValue(entry.power, powerRange);
    if (criteria.autonomy) utility += normalizedValue(entry.autonomy, autonomyRange);
    return { ...entry, score: Math.max(entry.score, Math.round(80 + (utility / criteriaCount) * 100)) };
  });
}

function fieldValues(product) {
  return {
    title: product.title,
    vendor: product.vendor,
    flavor: product.flavor,
    compatibility: product.compatibility,
    cartridges: product.cartridges,
    variants: (product.variants || []).map((variant) => `${variant.option || ''} ${variant.sku || ''}`).join(' '),
    tags: product.tags,
    type: product.type,
    structured: [product.power, product.draw, product.capacity, product.ratio, product.key_points].join(' '),
    description: [product.description, product.seo_description].join(' ')
  };
}

function buildIndex(products) {
  const indexed = products.map((product) => {
    const values = fieldValues(product);
    const fields = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, tokenSet(value)]));
    const allTokens = new Set(Object.values(fields).flatMap((set) => [...set]));
    return {
      product,
      normalizedTitle: normalize(product.title),
      normalizedSearch: normalize(Object.values(values).join(' ')),
      fields,
      allTokens
    };
  });

  const documentFrequency = new Map();
  for (const entry of indexed) {
    for (const token of entry.allTokens) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }
  return { indexed, documentFrequency, size: indexed.length };
}

const staticProducts = catalogFile.products;
const staticIndex = buildIndex(staticProducts);

function editDistanceAtMostOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let left = 0;
  let right = 0;
  let edits = 0;
  while (left < a.length && right < b.length) {
    if (a[left] === b[right]) {
      left += 1;
      right += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) left += 1;
    else if (b.length > a.length) right += 1;
    else {
      left += 1;
      right += 1;
    }
  }
  return edits + Number(left < a.length || right < b.length) <= 1;
}

function tokenMatchScore(token, entry, index) {
  let fieldScore = 0;
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    if (entry.fields[field].has(token)) fieldScore = Math.max(fieldScore, weight);
  }

  let matchedToken = token;
  if (!fieldScore && token.length >= 5 && !NO_FUZZY_TOKENS.has(token)) {
    const fuzzy = [...entry.allTokens].find((candidate) => candidate.length >= 5 && editDistanceAtMostOne(token, candidate));
    if (fuzzy) {
      matchedToken = fuzzy;
      for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
        if (entry.fields[field].has(fuzzy)) fieldScore = Math.max(fieldScore, Math.round(weight * 0.58));
      }
    }
  }
  if (!fieldScore) return 0;

  const frequency = index.documentFrequency.get(matchedToken) || index.size;
  const rarityBonus = Math.min(32, Math.max(0, Math.log2((index.size + 1) / (frequency + 1)) * 6));
  return fieldScore + rarityBonus;
}

export function searchProducts(query, products = staticProducts, limit = 8) {
  const index = products === staticProducts ? staticIndex : buildIndex(products);
  const normalizedQuery = normalize(query);
  const tokens = queryTokens(query);
  const family = requestedProductFamily(query);
  if (!tokens.length && !family) return [];

  let ranked = index.indexed
    .map((entry) => {
      let score = family && belongsToFamily(entry.product, family) ? 10 : 0;
      if (entry.normalizedTitle && normalizedQuery.includes(entry.normalizedTitle)) score += 150;
      if (normalizedQuery.length >= 4 && entry.normalizedSearch.includes(normalizedQuery)) score += 80;

      let matched = 0;
      let titleMatches = 0;
      for (const token of tokens) {
        const tokenScore = tokenMatchScore(token, entry, index);
        if (tokenScore > 0) matched += 1;
        if (entry.fields.title.has(token)) titleMatches += 1;
        score += tokenScore;
      }
      if (titleMatches >= 2) score += titleMatches * 24;
      if (tokens.length > 1 && matched === tokens.length) score += 36;
      if (tokens.length > 2 && matched / tokens.length < 0.5) score *= 0.45;
      return { ...entry, score: Math.round(score), coverage: tokens.length ? matched / tokens.length : 1 };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title, 'fr'));

  if (family) {
    const familyMatches = ranked.filter(({ product }) => belongsToFamily(product, family));
    ranked = familyMatches;
  }

  ranked = applyPreferences(ranked, query);

  const anchor = ranked[0];
  if (anchor?.score >= 60) {
    const linkedTokens = queryTokens([anchor.product.compatibility, anchor.product.cartridges].filter(Boolean).join(' '));
    if (linkedTokens.length) {
      for (const candidate of ranked) {
        if (candidate === anchor) continue;
        const titleTokens = tokenSet(candidate.product.title);
        const titleMatches = linkedTokens.filter((token) => titleTokens.has(token)).length;
        if (titleMatches === linkedTokens.length) candidate.score += 95;
        else if (titleMatches >= Math.min(2, linkedTokens.length)) candidate.score += 45;
      }
    }
  }

  return ranked
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title, 'fr'))
    .slice(0, limit)
    .map(({ product, score, coverage }) => ({ ...product, _score: score, _coverage: coverage }));
}

export function searchCatalog(query, limit = 8) {
  return searchProducts(query, staticProducts, limit);
}

export function mergeCatalogProducts(liveProducts = []) {
  const merged = new Map(staticProducts.map((product) => [product.handle, product]));
  for (const live of liveProducts) {
    const saved = merged.get(live.handle) || {};
    merged.set(live.handle, {
      ...live,
      ...saved,
      title: live.title || saved.title || '',
      vendor: live.vendor || saved.vendor || '',
      type: live.type || saved.type || '',
      tags: live.tags || saved.tags || '',
      description: live.description || saved.description || '',
      variants: live.variants?.length ? live.variants : (saved.variants || []),
      image: live.image || saved.image || '',
      url: live.url || saved.url || `/products/${live.handle}`
    });
  }
  return [...merged.values()];
}

export function hasConfidentMatch(products = [], minimumScore = 60, minimumGap = 18) {
  const firstScore = Number(products[0]?._score || 0);
  const secondScore = Number(products[1]?._score || 0);
  return firstScore >= minimumScore && (!products[1] || firstScore - secondScore >= minimumGap);
}

export function hasRelevantMatch(products = [], minimumScore = 35) {
  const first = products[0];
  return Number(first?._score || 0) >= minimumScore && Number(first?._coverage ?? 1) >= 0.5;
}

export function confidentProductAnswer(products = [], query = '') {
  const first = products[0];
  if (!first || !hasConfidentMatch(products)) return null;
  if (/\b(compar|moins cher|plus puissant|prix|budget|autonomie|meilleur rapport)\b/.test(normalize(query))) return null;

  const facts = [];
  if (first.flavor) facts.push(`Son profil aromatique associe ${first.flavor.replace(/,\s*([^,]+)$/, ' et $1')}.`);
  else if (first.key_points) facts.push(`${String(first.key_points).split('\n').find(Boolean).replace(/^✔\s*/, '')}.`);
  if (first.type && !normalize(first.title).includes(normalize(first.type))) facts.push(`Format : ${first.type}.`);
  return `Oui : ${first.title} correspond à votre recherche. ${facts.join(' ')} Je vous affiche sa fiche.`.replace(/\s+/g, ' ').trim();
}

export function publicSources(products, shopBaseUrl) {
  return products.slice(0, 4).map((product) => ({
    title: product.title,
    url: new URL(product.url, shopBaseUrl).toString(),
    vendor: product.vendor,
    variants: (product.variants || []).map((variant) => variant.option).filter(Boolean)
  }));
}

export function productCards(products, shopBaseUrl, limit = 3) {
  return products.slice(0, limit).map((product) => ({
    handle: product.handle,
    title: product.title,
    vendor: product.vendor,
    type: product.type,
    url: new URL(product.url, shopBaseUrl).toString(),
    image: product.image || '',
    price: (product.variants || []).find((variant) => variant.price)?.price || '',
    available: true,
    variants: (product.variants || []).map((variant) => ({
      title: variant.option,
      price: variant.price || '',
      available: true
    })).slice(0, 8),
    features: [product.draw, product.capacity, product.power, product.flavor, product.ratio, product.key_points]
      .filter(Boolean)
      .slice(0, 3),
    why: recommendationReason(product)
  }));
}

function recommendationReason(product) {
  if (product.compatibility || product.cartridges) {
    return `Sa compatibilité documentée correspond au matériel ou au composant recherché.`;
  }
  if (product.flavor) return `Son profil ${product.flavor.toLowerCase()} correspond à votre recherche.`;
  if (product.draw) return `Son tirage ${product.draw.toLowerCase()} correspond au style de vape recherché.`;
  return `Il fait partie des références CLASS’CLOPE les plus proches de votre demande.`;
}

export function verifyCompatibility(query, products) {
  const normalizedQuery = normalize(query);
  const isCompatibilityQuestion = /\b(compatib\w*|va avec|fonctionne avec|resistance|cartouche|clearomiseur|coil)\b/.test(normalizedQuery);
  if (!isCompatibilityQuestion) return { requested: false, status: 'not_applicable', evidence: [] };

  const pool = [...new Map([...products, ...staticProducts].map((product) => [product.handle, product])).values()];
  const querySet = tokenSet(normalizedQuery);
  const requestedOhms = [...normalizedQuery.matchAll(/\b(\d+(?:\.\d+)?)\s*ohm\b/g)].map((match) => match[1]);
  const common = new Set(['resistance', 'resistances', 'cartouche', 'cartouches', 'compatible', 'compatibles', 'avec', 'pour', 'boite', 'vaporesso', 'geekvape', 'voopoo']);
  const overlappingTokens = (value) => new Set(rawTokens(value).filter((token) => token.length > 1 && !common.has(token) && querySet.has(token)));
  const evidence = pool
    .filter((product) => product.compatibility || product.cartridges)
    .filter((product) => {
      const titleTokens = overlappingTokens(product.title);
      const statement = `${product.compatibility} ${product.cartridges}`;
      const statementTokens = overlappingTokens(statement);
      const crossReference = [...statementTokens].some((token) => !titleTokens.has(token));
      const integratedDeviceEvidence = titleTokens.size >= 2 && /resistances? integree?s?/.test(normalize(statement));
      if (titleTokens.size < 1 || (!crossReference && !integratedDeviceEvidence)) return false;
      if (!requestedOhms.length) return true;
      const variants = normalize((product.variants || []).map((variant) => variant.option).join(' '));
      return requestedOhms.every((ohm) => variants.includes(ohm));
    })
    .map((product) => ({
      product: product.title,
      statement: product.compatibility || product.cartridges,
      url: product.url
    }));

  if (!evidence.length) return { requested: true, status: 'unknown', evidence: [] };
  return { requested: true, status: 'verified', evidence };
}

export function compactContext(products) {
  return products.map((product) => ({
    title: product.title,
    marque: product.vendor,
    type: product.type,
    url: product.url,
    variantes: (product.variants || []).map((variant) => ({
      valeur: variant.option,
      prix: variant.price ? `${variant.price} €` : ''
    })),
    prix_minimum_catalogue: minimumPrice(product),
    compatibilite: product.compatibility || product.cartridges,
    puissance: product.power,
    tirage: product.draw,
    contenance: product.capacity,
    saveur: product.flavor,
    ratio: product.ratio,
    points_cles: product.key_points,
    description: product.description.slice(0, 1200)
  }));
}

export const catalogStats = Object.freeze({
  products: catalogFile.products.length,
  generatedAt: catalogFile.generated_at
});
