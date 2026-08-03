import catalogFile from '../data/catalog.json' with { type: 'json' };

const STOP_WORDS = new Set([
  'a', 'ai', 'avec', 'avez', 'avoir', 'base', 'besoin', 'boite', 'boîte', 'chez', 'choisir',
  'comment', 'conseil', 'dans', 'de', 'des', 'du', 'elle', 'elles', 'en', 'est', 'et', 'faire',
  'faut', 'feve', 'fève', 'je', 'la', 'le', 'les', 'liquide', 'liquides', 'e-liquide', 'e-liquides',
  'ma', 'mes', 'mon', 'pour', 'quelle', 'quelles', 'quel', 'quels', 'recherche', 'rechercher',
  'trouve', 'trouver', 'un', 'une', 'valeur', 'vape', 'veux', 'voudrais', 'vous'
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

export function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
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
  if (!fieldScore && token.length >= 5) {
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
  if (!tokens.length) return [];

  const ranked = index.indexed
    .map((entry) => {
      let score = 0;
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
      return { ...entry, score: Math.round(score) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title, 'fr'));

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
    .map(({ product, score }) => ({ ...product, _score: score }));
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

export function confidentProductAnswer(products = []) {
  const first = products[0];
  if (!first || !hasConfidentMatch(products)) return null;

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
    variants: product.variants.map((variant) => variant.option).filter(Boolean)
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
    price: product.variants.find((variant) => variant.price)?.price || '',
    available: true,
    variants: product.variants.map((variant) => ({
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
  const isCompatibilityQuestion = /\b(compatib|resistance|cartouche|clearomiseur|coil)\b/.test(normalizedQuery);
  if (!isCompatibilityQuestion) return { requested: false, status: 'not_applicable', evidence: [] };

  const evidence = products
    .filter((product) => product.compatibility || product.cartridges)
    .filter((product) => {
      const title = normalize(product.title);
      return normalizedQuery.includes(title) || title.split(' ').filter((part) => part.length > 2).every((part) => normalizedQuery.includes(part));
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
    variantes: product.variants.map((variant) => ({
      valeur: variant.option,
      prix: variant.price ? `${variant.price} €` : ''
    })),
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
