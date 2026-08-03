const cache = new Map();
const CACHE_MS = Number(process.env.SHOPIFY_CACHE_SECONDS || 45) * 1000;
const CATALOG_CACHE_MS = Number(process.env.SHOPIFY_CATALOG_CACHE_SECONDS || 600) * 1000;
let liveCatalogCache = { at: 0, products: [], promise: null };

const SEARCH_STOP_WORDS = new Set(['je', 'cherche', 'veux', 'vous', 'avez', 'avec', 'pour', 'dans', 'une', 'des', 'liquide', 'eliquide', 'produit', 'nouveau']);

export function liveSearchQueries(message = '') {
  const words = String(message).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter((word) => word.length > 2 && !SEARCH_STOP_WORDS.has(word));
  const queries = [];
  if (words.length) queries.push(words.join(' '));
  for (let size = Math.min(3, words.length); size >= 2; size -= 1) {
    for (let index = 0; index <= words.length - size; index += 1) queries.push(words.slice(index, index + size).join(' '));
  }
  queries.push(...words);
  return [...new Set(queries)].slice(0, 5);
}

export async function searchLiveCatalog(message, shopBaseUrl, signal) {
  const queries = liveSearchQueries(message);
  if (!queries.length) return [];
  const responses = await Promise.allSettled(queries.map(async (query) => {
    const url = new URL('/search/suggest.json', shopBaseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('resources[type]', 'product');
    url.searchParams.set('resources[limit]', '6');
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': "CLASS'CLOPE-Adviser/3.1" },
      signal
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return payload?.resources?.results?.products || [];
  }));
  const products = responses.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  return [...new Map(products.map((product) => [product.handle, {
    handle: product.handle,
    title: product.title || '',
    vendor: product.vendor || '',
    type: product.type || '',
    tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
    description: stripHtml(product.body || ''),
    seo_description: '',
    compatibility: '',
    cartridges: '',
    power: '',
    draw: '',
    capacity: '',
    flavor: '',
    ratio: '',
    key_points: '',
    variants: [],
    image: product.featured_image?.url || product.image || '',
    url: String(product.url || `/products/${product.handle}`).split('?')[0]
  }])).values()];
}

export async function enrichCardsFromShopify(cards, shopBaseUrl, signal) {
  return Promise.all(cards.slice(0, 3).map(async (card) => {
    try {
      const live = await fetchProduct(card.handle, shopBaseUrl, signal);
      return {
        ...card,
        title: live.title || card.title,
        image: live.featured_image || live.images?.[0] || card.image,
        price: formatPrice(live.price),
        available: Boolean(live.available),
        variants: (live.variants || []).map((variant) => ({
          id: variant.id,
          title: variant.title,
          price: formatPrice(variant.price),
          available: Boolean(variant.available)
        })).slice(0, 8)
      };
    } catch {
      return { ...card, price: '', variants: [], available: null, stockLabel: 'Disponibilité à confirmer' };
    }
  }));
}

async function fetchProduct(handle, shopBaseUrl, signal) {
  const key = String(handle);
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < CACHE_MS) return saved.value;
  const response = await fetch(new URL(`/products/${encodeURIComponent(handle)}.js`, shopBaseUrl), {
    headers: { Accept: 'application/json', 'User-Agent': "CLASS'CLOPE-Adviser/3.1" },
    signal
  });
  if (!response.ok) throw new Error(`Shopify ${response.status}`);
  const value = await response.json();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function formatPrice(value) {
  const cents = Number(value);
  if (!Number.isFinite(cents)) return '';
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|li|ul|ol|h[1-6]|div|section|strong)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFlavor(description = '') {
  const match = description.match(/\bSaveurs?\s*:\s*(.{2,120}?)(?=\s+(?:Contenance|Composition|Marque|Nicotine|Ratio|Origine|Conformité|Livraison)\s*:|$)/i);
  return match?.[1]?.trim() || '';
}

function extractLabeledValue(description = '', labels = []) {
  const alternation = labels.join('|');
  const match = description.match(new RegExp(`\\b(?:${alternation})\\s*:\\s*(.{1,100}?)(?=\\s+(?:Saveurs?|Contenance|Composition|Marque|Nicotine|Ratio|PG\\/VG|Puissance|Autonomie|Origine|Conformité|Livraison)\\s*:|$)`, 'i'));
  return match?.[1]?.trim() || '';
}

function liveProductToCatalog(product) {
  const description = stripHtml(product.body_html || '');
  return {
    handle: product.handle,
    title: product.title || '',
    vendor: product.vendor || '',
    type: product.product_type || '',
    tags: Array.isArray(product.tags) ? product.tags.join(', ') : String(product.tags || ''),
    description,
    seo_description: '',
    compatibility: '',
    cartridges: '',
    power: extractLabeledValue(description, ['Puissance', 'Puissance maximale']),
    draw: extractLabeledValue(description, ['Tirage', 'Type de tirage']),
    capacity: extractLabeledValue(description, ['Contenance', 'Capacité']),
    flavor: extractFlavor(description),
    ratio: extractLabeledValue(description, ['Ratio', 'PG\\/VG']),
    key_points: '',
    variants: (product.variants || []).map((variant) => ({
      option: variant.title || variant.option1 || '',
      sku: variant.sku || '',
      price: variant.price || '',
      grams: String(variant.grams ?? '')
    })),
    image: product.images?.[0]?.src || '',
    url: `/products/${product.handle}`
  };
}

async function fetchLiveCatalog(shopBaseUrl, signal) {
  const products = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL('/products.json', shopBaseUrl);
    url.searchParams.set('limit', '250');
    url.searchParams.set('page', String(page));
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': "CLASS'CLOPE-Adviser/3.1" },
      signal
    });
    if (!response.ok) throw new Error(`Catalogue Shopify ${response.status}`);
    const payload = await response.json();
    const pageProducts = Array.isArray(payload.products) ? payload.products : [];
    products.push(...pageProducts.map(liveProductToCatalog));
    if (pageProducts.length < 250) break;
  }
  return products;
}

export async function getLiveCatalog(shopBaseUrl, signal) {
  const fresh = liveCatalogCache.products.length && Date.now() - liveCatalogCache.at < CATALOG_CACHE_MS;
  if (fresh) return liveCatalogCache.products;
  if (!liveCatalogCache.promise) {
    liveCatalogCache.promise = fetchLiveCatalog(shopBaseUrl, signal)
      .then((products) => {
        liveCatalogCache = { at: Date.now(), products, promise: null };
        return products;
      })
      .catch((error) => {
        liveCatalogCache.promise = null;
        throw error;
      });
  }
  return liveCatalogCache.promise;
}
