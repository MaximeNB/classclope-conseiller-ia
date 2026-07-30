import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog, productCards, verifyCompatibility } from '../src/catalog.mjs';
import { guidedQuestion, needsHuman } from '../src/guidance.mjs';

test('une demande vague déclenche une question guidée courte', () => {
  const result = guidedQuestion('Aidez-moi à choisir mon premier kit', []);
  assert.equal(result.text, 'Pour bien vous orienter : êtes-vous débutant ou expérimenté ?');
  assert.ok(result.choices.length <= 4);
});

test('les recommandations sont limitées à trois cartes', () => {
  const products = searchCatalog('e liquide fruité', 8);
  const cards = productCards(products, 'https://www.classclope.fr');
  assert.ok(cards.length <= 3);
  assert.ok(cards.every((card) => card.why && card.url.startsWith('https://www.classclope.fr/')));
});

test('une compatibilité non documentée reste inconnue et propose un humain', () => {
  const products = searchCatalog('Modèle imaginaire ZX99 résistance', 8);
  const result = verifyCompatibility('La résistance ZX99 est-elle compatible avec mon Modèle imaginaire ?', products);
  assert.equal(result.status, 'unknown');
  assert.equal(needsHuman('Est-ce compatible ?', result), true);
});

test('une question de commande propose un humain', () => {
  assert.equal(needsHuman('Je veux parler à quelqu’un pour ma commande', { status: 'not_applicable' }), true);
});
