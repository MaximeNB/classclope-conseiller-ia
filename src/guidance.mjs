const SAFETY = [
  /\b(accu|batterie)\b.{0,30}\b(gonfl|abim|abîm|perc|fuit|odeur|brul|brûl|très chaud|tres chaud)\b/i,
  /\b(chauffe anormal|surchauffe|fumée|fumee|étincelle|etincelle|odeur de brûlé|odeur de brule)\w*/i,
  /\b(aval\w*.{0,20}liquide|liquide.{0,20}aval|ingér|inger|dans mon (oeil|œil)|intox)\b/i
];
const HEALTH = [/\b(medical|médical|grossesse|enceinte|allaitement|malaise|intoxication|sante|santé|sevrage|vertige|nausée|nausee)\b/i];
const ORDER = [
  /\b(commande|colis|livraison|expédition|expedition|transporteur|suivi|tracking)\b/i,
  /\b(retour|remboursement|rétractation|retractation|sav|article manquant|produit cassé|produit casse)\b/i,
  /\b(modifier|annuler|adresse)\b.{0,25}\b(commande|livraison|colis)\b/i
];
const TROUBLESHOOTING = [
  /\b(ne marche|ne fonctionne|ne s['’]?allume|ne charge|ne tire|ne produit|impossible|plus de vapeur)\b/i,
  /\b(probleme|problème|panne|bug|defaut|défaut|erreur|clignote|bloqu|bouch[eé]|n['’]?est pas reconnue?)\w*/i,
  /\b(fuite|coule|liquide dans la bouche|remonte|glouglou|gargouille|projection)\b/i,
  /\b(gout|goût).{0,12}(brule|brûlé|crame|cramé)/i,
  /\b(chauffe trop|bruit bizarre|crépite trop|crepite trop)\b/i
];
const COMPATIBILITY = [
  /\b(compatib\w*|va avec|fonctionne avec|quelle résistance pour|quelle resistance pour)\b/i,
  /\b(cartouche|résistance|resistance|clearomiseur|coil)\b.{0,35}\b(pour|avec|sur)\b/i
];
const RECOMMENDATION = [
  /\b(acheter|achat|choisir|recommande|recommandation|conseille|cherche|quel produit|quelle cigarette|quel kit|quel pod|quel liquide)\b/i,
  /\b(alternative|équivalent|equivalent|remplacer par)\b/i
];

function users(history) {
  return history.filter((item) => item?.role === 'user').map((item) => String(item.content || ''));
}

function explicitIntent(message) {
  if (SAFETY.some((pattern) => pattern.test(message))) return 'safety';
  if (HEALTH.some((pattern) => pattern.test(message))) return 'health';
  if (TROUBLESHOOTING.some((pattern) => pattern.test(message))) return 'troubleshooting';
  if (ORDER.some((pattern) => pattern.test(message))) return 'order_support';
  if (COMPATIBILITY.some((pattern) => pattern.test(message))) return 'compatibility';
  if (RECOMMENDATION.some((pattern) => pattern.test(message))) return 'recommendation';
  return null;
}

export function conversationIntent(message, history = []) {
  const current = String(message || '').trim();
  const detected = explicitIntent(current);
  if (detected) return detected;
  // Une réponse courte poursuit le dernier parcours explicite.
  if (current.length <= 80) {
    const previous = users(history).reverse().map(explicitIntent).find(Boolean);
    if (previous) return previous;
  }
  return 'information';
}

export function shouldShowProductCards(intent, message = '') {
  if (intent === 'compatibility') return true;
  return intent === 'recommendation' && RECOMMENDATION.some((pattern) => pattern.test(message));
}

export function guidedQuestion(message, history = []) {
  if (conversationIntent(message, history) !== 'recommendation') return null;
  const combined = [...users(history), message].join(' ').toLowerCase();
  if (/\b(e liquide|e-liquide|eliquide|liquide)\b/.test(combined)) {
    if (!/\b(fruit|classic|tabac|menthe|gourmand|boisson)\b/.test(combined)) {
      return { text: 'Quel profil de saveur recherchez-vous ?', choices: ['Fruité', 'Menthe', 'Classic', 'Gourmand'] };
    }
    if (!/\b(frais|sans frais|non frais)\b/.test(combined)) {
      return { text: 'Préférez-vous une sensation fraîche ?', choices: ['Oui, frais', 'Non, sans frais'] };
    }
    if (!/\b(0|3|6|10|12|18|20)\s*(mg|mg\/ml)?\b/.test(combined)) {
      return { text: 'Quel taux de nicotine utilisez-vous ?', choices: ['0 mg', '3 mg', '6 mg', 'Je ne sais pas'] };
    }
    return null;
  }
  if (!/\b(debutant|débutant|experimente|expérimenté)\b/.test(combined)) {
    return { text: 'Pour bien vous orienter : êtes-vous débutant ou expérimenté ?', choices: ['Débutant', 'Expérimenté'] };
  }
  if (!/\b(mtl|serre|serré|rdl|aerien|aérien)\b/.test(combined)) {
    return { text: 'Quel tirage préférez-vous ?', choices: ['Serré MTL', 'Polyvalent RDL', 'Aérien'] };
  }
  if (!/\b\d+\s*(€|euros?)\b/.test(combined)) {
    return { text: 'Quel budget maximum souhaitez-vous consacrer à ce produit ?', choices: ['Moins de 30 €', '30 à 50 €', 'Plus de 50 €'] };
  }
  return null;
}

export function orderSupport(message, shopBaseUrl) {
  if (!ORDER.some((pattern) => pattern.test(message))) return null;
  const tracking = /\b(où|ou est|suivre|suivi|tracking|arrivé|arrive|livré|livre)\b/i.test(message);
  if (tracking) {
    return {
      text: "Vous pouvez consulter l’état de votre commande depuis votre espace client CLASS’CLOPE. Si le suivi n’évolue plus ou si le colis est indiqué livré mais absent, utilisez le bouton « Parler à un conseiller ».",
      link: { label: 'Suivre ma commande', url: new URL('/account', shopBaseUrl).toString() }
    };
  }
  return {
    text: "Pour protéger vos informations, je ne peux pas consulter ni modifier une commande directement dans ce chat. Utilisez le bouton « Parler à un conseiller » : l’équipe pourra vérifier votre demande de façon sécurisée.",
    link: { label: 'Contacter le service client', url: new URL('/pages/contact', shopBaseUrl).toString() }
  };
}

export function safetyResponse(message) {
  if (!SAFETY.some((pattern) => pattern.test(message))) return null;
  return "Arrêtez immédiatement d’utiliser et de recharger l’appareil. Éloignez-le des matières inflammables, ne démontez pas l’accu et contactez rapidement l’équipe CLASS’CLOPE. En cas d’ingestion, de contact avec les yeux ou de malaise, contactez sans attendre un professionnel de santé ou les secours.";
}

export function needsHuman(message, compatibility, intent = '') {
  return ['safety', 'health', 'order_support'].includes(intent) ||
    compatibility.status === 'unknown' ||
    ORDER.some((pattern) => pattern.test(message)) ||
    /\b(humain|personne|conseiller|service client|sav)\b/i.test(message);
}
