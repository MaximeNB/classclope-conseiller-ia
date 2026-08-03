import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog } from '../src/catalog.mjs';

test('retrouve GTX avec le matériel Luxe XR MAX', () => {
  const results = searchCatalog('J’ai un Luxe XR MAX Vaporesso, quelle résistance choisir ?');
  assert.ok(results.some((product) => /GTX/i.test(product.title)));
});

test('retrouve les cartouches Q Pod 2 ml', () => {
  const results = searchCatalog('Q Pod 2 ml Geekvape 0,8 ohm');
  assert.match(results[0].title, /Q Pod 2 ml/i);
});

test('retrouve XROS malgré une faute courante', () => {
  const results = searchCatalog('cartouche xross 3ml vaporesso');
  assert.ok(results.some((product) => /XROS 3\s*ml/i.test(product.title)));
});

test('retrouve Emrald Slash avec la tonka et le nom exact', () => {
  const results = searchCatalog('Je cherche un liquide à la fève tonka, vous avez Emrald Slash de OverCloud ?');
  assert.match(results[0].title, /Emrald Slash 50ml - Overcloud/i);
  assert.ok(results[0]._score >= 60);
});

test('retrouve Emrald Slash malgré les variantes emerald et emral', () => {
  for (const query of ['Emerald Slash OverCloud', 'Emral Slash OverCloud']) {
    assert.match(searchCatalog(query)[0].title, /Emrald Slash/i);
  }
});
