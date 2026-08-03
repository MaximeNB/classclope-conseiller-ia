import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog, productCards, verifyCompatibility } from '../src/catalog.mjs';
import {
  assistantConfigurationResponse,
  conversationIntent,
  guidedQuestion,
  needsHuman,
  orderSupport,
  safetyResponse,
  searchFeedbackResponse,
  shouldShowCatalogSources,
  shouldShowProductCards
} from '../src/guidance.mjs';
import { liveSearchQueries } from '../src/shopify.mjs';

test('une demande vague déclenche une question guidée courte', () => {
  const result = guidedQuestion('Aidez-moi à choisir mon premier kit', []);
  assert.equal(result.text, 'Pour bien vous orienter : êtes-vous débutant ou expérimenté ?');
  assert.ok(result.choices.length <= 4);
});

test('un produit précis retrouvé ne déclenche pas le questionnaire générique', () => {
  const message = 'Je cherche un liquide à la fève tonka, vous avez Emrald Slash de OverCloud ?';
  assert.equal(guidedQuestion(message, [], searchCatalog(message)), null);
});

test('tonka seul déclenche une recommandation précise sans questionnaire', () => {
  const products = searchCatalog('tonka');
  const intent = conversationIntent('tonka', [], products);
  assert.equal(intent, 'recommendation');
  assert.equal(guidedQuestion('tonka', [], products), null);
  assert.equal(shouldShowProductCards(intent, 'tonka', products), true);
});

test('la recherche Shopify rapide extrait le nom utile', () => {
  const queries = liveSearchQueries('Je cherche le nouveau Emerald Slash de OverCloud');
  assert.ok(queries.includes('emerald slash overcloud'));
  assert.ok(queries.includes('emerald slash'));
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

test('un problème de matériel passe en dépannage sans cartes produit', () => {
  const intent = conversationIntent('Ma cigarette électronique ne fonctionne plus, vous pouvez m’aider ?');
  assert.equal(intent, 'troubleshooting');
  assert.equal(shouldShowProductCards(intent), false);
});

test('une fuite de liquide ne déclenche pas une recommandation de liquide', () => {
  const intent = conversationIntent('J’ai une fuite de liquide dans la bouche avec mon pod');
  assert.equal(intent, 'troubleshooting');
  assert.equal(shouldShowProductCards(intent), false);
});

test('un goût de brûlé reste un dépannage même si une résistance est citée', () => {
  const intent = conversationIntent('Ma résistance a un goût de brûlé, quel est le problème ?');
  assert.equal(intent, 'troubleshooting');
  assert.equal(shouldShowProductCards(intent), false);
  assert.equal(guidedQuestion('Ma résistance a un goût de brûlé, quel est le problème ?', []), null);
});

test('une demande explicite de choix conserve les cartes produit', () => {
  const intent = conversationIntent('Je cherche un e-liquide fruité');
  assert.equal(intent, 'recommendation');
  assert.equal(shouldShowProductCards(intent, 'Je cherche un e-liquide fruité'), true);
});

test('je veux un liquide est bien une recommandation produit', () => {
  assert.equal(conversationIntent('je veux un liquide a base de tonka'), 'recommendation');
});

test('une question technique complète ne reprend pas à tort le parcours produit', () => {
  const history = [
    { role: 'user', content: 'je veux un liquide a base de tonka' },
    { role: 'assistant', content: 'Emrald Slash correspond.' }
  ];
  const message = 'ok comment faire pour que je modifie ton code et que tu sois ultra performant';
  assert.equal(conversationIntent(message, history), 'assistant_configuration');
  assert.match(assistantConfigurationResponse(message), /synchroniser automatiquement tout le catalogue Shopify/i);
});

test('une contradiction sur un produit obtient une explication honnête', () => {
  const products = searchCatalog('je veux un liquide a base de tonka');
  const answer = searchFeedbackResponse('pourtant tu en as sur le site', products);
  assert.match(answer, /mal classé/i);
  assert.match(answer, /Emrald Slash/i);
  assert.doesNotMatch(answer, /vient d'être chargé|apparaît maintenant/i);
});

test("pourquoi tu ne l'as pas trouvé est reconnu comme un retour de recherche", () => {
  assert.equal(conversationIntent("pourquoi tu ne l'as pas trouvé"), 'search_feedback');
});

const intentScenarios = [
  ['Ma cigarette ne fonctionne plus', 'troubleshooting'],
  ['Le pod clignote rouge', 'troubleshooting'],
  ['Je n’ai plus de vapeur', 'troubleshooting'],
  ['J’ai une fuite', 'troubleshooting'],
  ['Du liquide remonte dans la bouche', 'troubleshooting'],
  ['Ça fait glouglou', 'troubleshooting'],
  ['La résistance a un goût de brûlé', 'troubleshooting'],
  ['Ma résistance n’est pas reconnue', 'troubleshooting'],
  ['Elle ne charge plus', 'troubleshooting'],
  ['Le bouton est bloqué', 'troubleshooting'],
  ['Ma batterie est gonflée', 'safety'],
  ['Mon accu sent le brûlé', 'safety'],
  ['L’appareil chauffe anormalement', 'safety'],
  ['J’ai avalé du liquide', 'safety'],
  ['Du liquide est allé dans mon œil', 'safety'],
  ['Je suis enceinte', 'health'],
  ['J’ai un malaise après avoir vapé', 'health'],
  ['Je veux suivre ma commande', 'order_support'],
  ['Où est mon colis ?', 'order_support'],
  ['Ma livraison est en retard', 'order_support'],
  ['Je veux annuler ma commande', 'order_support'],
  ['Il manque un article dans mon colis', 'order_support'],
  ['Je souhaite un remboursement', 'order_support'],
  ['Je veux faire un retour', 'order_support'],
  ['Cette résistance est-elle compatible ?', 'compatibility'],
  ['Quelle résistance pour ma Luxe XR ?', 'compatibility'],
  ['Cette cartouche va avec mon pod ?', 'compatibility'],
  ['Je cherche un kit débutant', 'recommendation'],
  ['Quel liquide me conseillez-vous ?', 'recommendation'],
  ['Je veux acheter un pod', 'recommendation'],
  ['Avez-vous une alternative ?', 'recommendation'],
  ['Comment amorcer une résistance ?', 'information'],
  ['Quelle est votre adresse ?', 'information']
];

for (const [message, expected] of intentScenarios) {
  test(`intention premium : ${message}`, () => {
    assert.equal(conversationIntent(message), expected);
  });
}

test('une réponse courte conserve le dépannage', () => {
  const history = [{ role: 'user', content: 'Mon pod ne fonctionne plus' }, { role: 'assistant', content: 'Quelle couleur voyez-vous ?' }];
  assert.equal(conversationIntent('rouge', history), 'troubleshooting');
});

test('une réponse courte conserve le SAV', () => {
  const history = [{ role: 'user', content: 'Ma livraison est en retard' }, { role: 'assistant', content: 'Consultez le suivi.' }];
  assert.equal(conversationIntent('toujours rien', history), 'order_support');
});

test('le suivi utilise uniquement une URL officielle', () => {
  const result = orderSupport('Je veux suivre ma commande', 'https://www.classclope.fr');
  assert.equal(result.link.url, 'https://www.classclope.fr/account');
});

test('une demande SAV utilise le contact officiel', () => {
  const result = orderSupport('Je veux modifier ma commande', 'https://www.classclope.fr');
  assert.equal(result.link.url, 'https://www.classclope.fr/pages/contact');
});

test('la sécurité impose un arrêt immédiat', () => {
  assert.match(safetyResponse('Ma batterie est gonflée'), /Arrêtez immédiatement/);
});

test('aucune carte sur une commande', () => {
  assert.equal(shouldShowProductCards('order_support', 'Je cherche ma commande'), false);
});

test('aucune source catalogue visible pendant le dépannage ou le SAV', () => {
  assert.equal(shouldShowCatalogSources('troubleshooting'), false);
  assert.equal(shouldShowCatalogSources('order_support'), false);
  assert.equal(shouldShowCatalogSources('information'), false);
  assert.equal(shouldShowCatalogSources('recommendation'), true);
});

test('aucune carte sur une réponse courte de recommandation mémorisée', () => {
  assert.equal(shouldShowProductCards('recommendation', 'oui'), false);
});
