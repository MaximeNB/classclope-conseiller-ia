import test from 'node:test';
import assert from 'node:assert/strict';
import { confidentProductAnswer, searchCatalog } from '../src/catalog.mjs';

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

test('retrouve Emrald Slash avec le seul mot tonka et un score fiable', () => {
  const results = searchCatalog('tonka');
  assert.match(results[0].title, /Emrald Slash/i);
  assert.ok(results[0]._score >= 60);
});

test('comprend fève tonka comme la saveur tonka', () => {
  for (const query of ['fève tonka', 'fève de tonka']) {
    assert.match(searchCatalog(query)[0].title, /Emrald Slash/i);
  }
});

test('retrouve Emrald Slash avec cookie tonka', () => {
  assert.match(searchCatalog('cookie tonka')[0].title, /Emrald Slash/i);
});

test('retrouve Tonka dès la vraie première phrase du client', () => {
  const results = searchCatalog('je veux un liquide a base de tonka');
  assert.match(results[0].title, /Emrald Slash/i);
  assert.ok(results[0]._score >= 60);
  assert.match(confidentProductAnswer(results), /Tonka, Biscuit et Cookie/i);
});

test('retrouve Tonka avec plusieurs formulations naturelles', () => {
  for (const query of [
    'je cherche un liquide à la fève tonka',
    'avez-vous un liquide tonka ?',
    'liquide tonka',
    'je veux un liquide gourmand au tonka'
  ]) {
    assert.match(searchCatalog(query)[0].title, /Emrald Slash/i, query);
  }
});

test('ne confond pas le mot liquide avec la marque Liquideo', () => {
  const results = searchCatalog('je veux un liquide a base de tonka');
  assert.doesNotMatch(results[0].title, /Liquideo/i);
});

test('une recherche de pod exclut cartouches et résistances', () => {
  const results = searchCatalog('pod le moins cher et le plus puissant', 8);
  assert.ok(results.length >= 2);
  assert.ok(results.every((product) => /matériel|pods/i.test(product.type)));
  assert.ok(results.every((product) => !/cartouche|résistance|clearomiseur/i.test(`${product.type} ${product.title}`)));
  assert.ok(results.slice(0, 3).every((product) => product.variants.some((variant) => variant.price)));
});

test('une recherche de cartouche conserve les cartouches', () => {
  const results = searchCatalog('cartouche Q Pod Geekvape', 5);
  assert.ok(results.length > 0);
  assert.ok(results.every((product) => /cartouche/i.test(`${product.type} ${product.title}`)));
});
