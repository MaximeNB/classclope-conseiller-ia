import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const cliInputs = process.argv.slice(2);
const outputArgumentIndex = cliInputs.indexOf('--output');
const output = resolve(
  outputArgumentIndex >= 0 && cliInputs[outputArgumentIndex + 1]
    ? cliInputs[outputArgumentIndex + 1]
    : 'data/catalog.json'
);
const inputArguments = cliInputs.filter((argument, index) => {
  if (argument === '--output') return false;
  if (outputArgumentIndex >= 0 && index === outputArgumentIndex + 1) return false;
  return true;
});
const inputs = (
  inputArguments.length
    ? inputArguments
    : [
        '../../upload/products_export_1 (1)(2).csv',
        '../../outputs/catalogue-shopify-final/CLASSCLOPE-import-Shopify-sans-nouvelles-images-corrige.csv'
      ]
).map((input) => resolve(input));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function cleanHeader(value) {
  return value.replace(/^\uFEFF+/, '').trim();
}

function stripHtml(value = '') {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|li|ul|ol|h[1-6])[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const products = new Map();

for (const input of inputs) {
  const raw = await readFile(input, 'utf8');
  const rows = parseCsv(raw);
  const headers = rows.shift().map(cleanHeader);
  const indexOf = (name) => headers.indexOf(name);
  const value = (row, name) => {
    const index = indexOf(name);
    return index >= 0 ? (row[index] || '').trim() : '';
  };

  for (const row of rows) {
    const handle = value(row, 'Handle');
    if (!handle) continue;

    if (!products.has(handle)) {
      products.set(handle, {
        handle,
        title: '',
        vendor: '',
        type: '',
        tags: '',
        description: '',
        seo_description: '',
        compatibility: '',
        cartridges: '',
        power: '',
        draw: '',
        capacity: '',
        flavor: '',
        ratio: '',
        key_points: '',
        variants: []
      });
    }

    const product = products.get(handle);
    const setIfPresent = (field, nextValue) => {
      if (nextValue) product[field] = nextValue;
    };
    setIfPresent('title', value(row, 'Title'));
    setIfPresent('vendor', value(row, 'Vendor'));
    setIfPresent('type', value(row, 'Type'));
    setIfPresent('tags', value(row, 'Tags'));
    setIfPresent('description', stripHtml(value(row, 'Body (HTML)')));
    setIfPresent('seo_description', value(row, 'SEO Description'));
    setIfPresent('compatibility', value(row, 'compatibilite_resistances (product.metafields.custom.compatibilite_resistances)'));
    setIfPresent('cartridges', value(row, 'Cartouches compatibles (product.metafields.custom.cartouches_compatibles)'));
    setIfPresent('power', value(row, 'Puissance max (product.metafields.custom.puissance_max)'));
    setIfPresent('draw', value(row, 'tirage (product.metafields.custom.tirage)'));
    setIfPresent(
      'capacity',
      value(row, 'Contenance (product.metafields.custom.contenance)') ||
        value(row, 'capacite cartouche (product.metafields.custom.capacite_cartouche)')
    );
    setIfPresent('flavor', value(row, 'Saveur (product.metafields.custom.saveur)'));
    setIfPresent('ratio', value(row, 'Ratio PG/VG (product.metafields.custom.ratio_pg_vg)'));
    setIfPresent('key_points', value(row, 'Points clés (product.metafields.custom.points_cles)'));

    const option = value(row, 'Option1 Value');
    const sku = value(row, 'Variant SKU');
    if (option || sku) {
      const variant = {
        option,
        sku,
        price: value(row, 'Variant Price'),
        grams: value(row, 'Variant Grams')
      };
      const existingIndex = product.variants.findIndex(
        (candidate) => (sku && candidate.sku === sku) || (!sku && candidate.option === option)
      );
      if (existingIndex >= 0) product.variants[existingIndex] = variant;
      else product.variants.push(variant);
    }
  }
}

const catalog = [...products.values()]
  .filter((product) => product.title)
  .map((product) => ({
    ...product,
    url: `/products/${product.handle}`,
    variants: product.variants.filter(
      (variant, index, variants) =>
        variants.findIndex((candidate) => candidate.sku === variant.sku && candidate.option === variant.option) === index
    )
  }))
  .sort((a, b) => a.title.localeCompare(b.title, 'fr'));

await writeFile(
  output,
  `${JSON.stringify({ generated_at: new Date().toISOString(), count: catalog.length, products: catalog }, null, 2)}\n`,
  'utf8'
);

console.log(`Catalogue généré : ${catalog.length} produits depuis ${inputs.length} export(s) → ${output}`);
