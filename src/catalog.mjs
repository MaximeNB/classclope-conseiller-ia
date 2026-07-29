import catalogFile from '../data/catalog.json' with { type: 'json' };

const STOP_WORDS = new Set([
  'ai', 'avec', 'avoir', 'besoin', 'boite', 'boîte', 'cartouche', 'cartouches', 'chez', 'choisir',
  'comment', 'compatible', 'compatibles', 'conseil', 'dans', 'de', 'des', 'du', 'elle', 'elles',
  'en', 'est', 'et', 'faire', 'faut', 'je', 'la', 'le', 'les', 'ma', 'mes', 'mon', 'pour',
  'quelle', 'quelles', 'quel', 'quels',
  'resistance', 'résistance', 'résistances', 'sur', 'une', 'valeur', 'vape', 'vous'
]);

function normalize(value = '') {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\bxross\b/g, 'xros')
    .replace(/\bxrmax\b/g, 'xr max')
    .replace(/\bgeek vape\b/g, 'geekvape')
    .replace(/\bvapo resso\b/g, 'vaporesso')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value) {
  return [...new Set(normalize(value).split(' ').filter((token) => token.length > 1 && !STOP_WORDS.has(token)))];
}

function searchable(product) {
  return normalize([
    product.title,
    product.vendor,
    product.type,
    product.tags,
    product.description,
    product.compatibility,
    product.cartridges,
    product.power,
    product.draw,
    product.capacity,
    product.flavor,
    product.ratio,
    product.key_points,
    product.variants.map((variant) => `${variant.option} ${variant.sku}`).join(' ')
  ].join(' '));
}

const indexedProducts = catalogFile.products.map((product) => ({
  product,
  normalizedTitle: normalize(product.title),
  haystack: searchable(product)
}));

export function searchCatalog(query, limit = 8) {
  const normalizedQuery = normalize(query);
  const queryTokens = tokens(query);

  const ranked = indexedProducts
    .map(({ product, normalizedTitle, haystack }) => {
      let score = 0;
      if (normalizedTitle && normalizedQuery.includes(normalizedTitle)) score += 120;
      if (normalizedQuery.length >= 4 && haystack.includes(normalizedQuery)) score += 70;

      for (const token of queryTokens) {
        if (normalizedTitle.includes(token)) score += 18;
        else if (haystack.includes(token)) score += 5;
      }

      const matched = queryTokens.filter((token) => haystack.includes(token)).length;
      if (queryTokens.length > 1 && matched === queryTokens.length) score += 30;
      return { product, normalizedTitle, haystack, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title, 'fr'));

  const anchor = ranked[0];
  if (anchor?.score >= 60) {
    const linkedText = [anchor.product.compatibility, anchor.product.cartridges].filter(Boolean).join(' ');
    const linkedTokens = tokens(linkedText);
    if (linkedTokens.length) {
      for (const candidate of ranked) {
        if (candidate === anchor) continue;
        const titleMatches = linkedTokens.filter((token) => candidate.normalizedTitle.includes(token)).length;
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

export function publicSources(products, shopBaseUrl) {
  return products.slice(0, 4).map((product) => ({
    title: product.title,
    url: new URL(product.url, shopBaseUrl).toString(),
    vendor: product.vendor,
    variants: product.variants.map((variant) => variant.option).filter(Boolean)
  }));
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
