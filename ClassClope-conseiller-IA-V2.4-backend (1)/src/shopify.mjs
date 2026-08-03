const cache = new Map();
const CACHE_MS = Number(process.env.SHOPIFY_CACHE_SECONDS || 45) * 1000;

export async function enrichCardsFromShopify(cards, shopBaseUrl, signal) {
  const results = [];
  for (const card of cards.slice(0, 3)) {
    try {
      const live = await fetchProduct(card.handle, shopBaseUrl, signal);
      results.push({
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
      });
    } catch {
      results.push({ ...card, available: null, stockLabel: 'Disponibilité à confirmer' });
    }
  }
  return results;
}

async function fetchProduct(handle, shopBaseUrl, signal) {
  const key = String(handle);
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < CACHE_MS) return saved.value;
  const response = await fetch(new URL(`/products/${encodeURIComponent(handle)}.js`, shopBaseUrl), {
    headers: { Accept: 'application/json', 'User-Agent': "CLASS'CLOPE-Adviser/2.0" },
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
