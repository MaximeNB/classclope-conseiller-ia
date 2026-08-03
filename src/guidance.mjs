const SAFETY = [
  /\b(accu|batterie)\b.{0,30}\b(gonfl|abim|abîm|perc|fuit|odeur|brul|brûl|très chaud|tres chaud)\b/i,
  /\b(chauffe anormal|surchauffe|fumée|fumee|étincelle|etincelle|odeur de brûlé|odeur de brule)\w*/i,
  /\b(aval\w*.{0,20}liquide|liquide.{0,20}aval|ingér|inger|(?:dans|sur)\s+(?:mon|l['’]?)?\s*(?:oeil|œil|yeux)|intox)\b/i,
  /\b(accu|batterie|cigarette|pod|box)\b.{0,35}\b(eau|mouille|mouillé|immerg|tomb[eé].{0,12}eau)\b/i,
  /\b(liquide|nicotine)\b.{0,25}\b(peau|main|visage)\b/i
];
const HEALTH = [/\b(medical|médical|grossesse|enceinte|allaitement|malaise|intoxication|sante|santé|sevrage|vertige|nausée|nausee|toux|tousse|palpitation|douleur thoracique|mal de tête|maux de tête|essouffl|allerg)\w*/i];
const COMPLIANCE = [
  /\b(?:j['’]?ai|age|âgé de)\s*(?:1[0-7]|[0-9])\s*ans\b/i,
  /\b(mineur|moins de 18 ans)\b/i,
  /\b(je ne fume pas|jamais fum[eé]|non[- ]?fumeur)\b.{0,45}\b(commencer|essayer|tester|vapoter|vape)\b/i
];
const SECURITY = [
  /\b(cl[eé] api|api key|mot de passe|secret|token)\b/i,
  /\b(ignore|oublie|contourne)\b.{0,35}\b(r[eè]gle|instruction|consigne|syst[eè]me|prompt)\b/i,
  /\b(r[eé]v[eè]le|affiche|donne)\b.{0,35}\b(prompt|instruction|consigne interne|secret)\b/i
];
const CALCULATION = [
  /\b(combien|calcul|quantit[eé]|nombre)\b.{0,35}\b(booster|nicotine|mg\/ml)\b/i,
  /\b(booster|nicotine)\b.{0,35}\b(combien|calcul|ml|mg\/ml)\b/i
];
const SHOP_INFORMATION = [
  /\b(d[eé]lais?|frais|mode|transporteur)\b.{0,30}\b(livraison|exp[eé]dition)\b/i,
  /\b(livraison gratuite|livraison offerte|moyens? de paiement|horaire|boutique|magasin|adresse email|t[eé]l[eé]phone)\b/i,
  /\b(compte obligatoire|commander sans compte|commander en invit[eé])\b/i
];
const ORDER = [
  /\b(ma|mon|mes|notre|n[°o]|num[eé]ro)\b.{0,16}\b(commande|colis|livraison|suivi)\b/i,
  /\b(o[uù] est|suivre|tracking|retard|pas re[cç]u|non re[cç]u|indiqu[eé] livr[eé])\b.{0,30}\b(commande|colis|livraison)?\b/i,
  /\b(article manquant|produit cass[eé]|produit d[eé]fectueux|sav)\b/i,
  /\b(je veux|je souhaite|demande|obtenir)\b.{0,25}\b(remboursement|retour)\b/i,
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
  /\b(alternative|équivalent|equivalent|remplacer par)\b/i,
  /\b(je veux|je voudrais|avez[- ]?vous|vous avez|trouve(?:z)?[- ]?moi|propose(?:z)?[- ]?moi)\b.{0,55}\b(liquide|e[- ]?liquide|kit|pod|puff|cigarette|résistance|resistance|cartouche|concentré|concentre)\b/i,
  /\b(quel|quelle|quels|quelles)\b.{0,30}\b(pod|kit|liquide|puff|résistance|resistance|cartouche)\b/i,
  /\b(moins cher|plus puissant|meilleur rapport|plus grande autonomie)\b.{0,45}\b(pod|kit|matériel|materiel|cigarette|liquide|résistance|resistance)\b/i
];
const ASSISTANT_CONFIGURATION = [
  /\b(modifi\w*|amélior\w*|amelior\w*|optimis\w*|programm\w*|configur\w*)\b.{0,45}\b(code|agent|assistant|ia|règles|regles|recherche|catalogue|prompt)\b/i,
  /\b(code|agent|assistant|ia|règles|regles|prompt)\b.{0,45}\b(modifi\w*|amélior\w*|amelior\w*|optimis\w*|programm\w*|configur\w*)\b/i
];
const SEARCH_FEEDBACK = [
  /\bpourquoi\b.{0,50}\b(pas trouvé|pas trouve|ne (?:l['’])?as pas trouvé|ne (?:l['’])?as pas trouve|introuvable)/i,
  /\b(pourtant|mais)\b.{0,35}\b(en as|sur le site|au catalogue|existe)\b/i
];

function users(history) {
  return history.filter((item) => item?.role === 'user').map((item) => String(item.content || ''));
}

function normalized(value = '') {
  return String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function conversationText(message, history = []) {
  return normalized([...history.map((item) => item?.content || ''), message].join(' '));
}

function wasAsked(history, fragment) {
  const needle = normalized(fragment);
  return history.some((item) => item?.role === 'assistant' && normalized(item.content).includes(needle));
}

function explicitIntent(message) {
  if (SAFETY.some((pattern) => pattern.test(message))) return 'safety';
  if (HEALTH.some((pattern) => pattern.test(message))) return 'health';
  if (COMPLIANCE.some((pattern) => pattern.test(message))) return 'compliance';
  if (SECURITY.some((pattern) => pattern.test(message))) return 'security';
  if (ASSISTANT_CONFIGURATION.some((pattern) => pattern.test(message))) return 'assistant_configuration';
  if (TROUBLESHOOTING.some((pattern) => pattern.test(message))) return 'troubleshooting';
  if (CALCULATION.some((pattern) => pattern.test(message))) return 'calculation';
  if (SHOP_INFORMATION.some((pattern) => pattern.test(message))) return 'shop_information';
  if (ORDER.some((pattern) => pattern.test(message))) return 'order_support';
  if (SEARCH_FEEDBACK.some((pattern) => pattern.test(message))) return 'search_feedback';
  if (COMPATIBILITY.some((pattern) => pattern.test(message))) return 'compatibility';
  if (RECOMMENDATION.some((pattern) => pattern.test(message))) return 'recommendation';
  return null;
}

function isShortContinuation(message) {
  const text = String(message || '').trim();
  if (!text || text.length > 70 || text.split(/\s+/).length > 9) return false;
  return !/\b(comment|pourquoi|quel|quelle|quels|quelles|modifier|améliorer|ameliorer|code|agent|assistant|ia)\b/i.test(text);
}

function hasStrongProduct(products = []) {
  const firstScore = Number(products[0]?._score || 0);
  const secondScore = Number(products[1]?._score || 0);
  return firstScore >= 60 && (!products[1] || firstScore - secondScore >= 18);
}

export function conversationIntent(message, history = [], products = []) {
  const current = String(message || '').trim();
  const detected = explicitIntent(current);
  if (detected) return detected;
  if (current.split(/\s+/).length <= 5 && hasStrongProduct(products)) return 'recommendation';
  // Une réponse courte poursuit le dernier parcours explicite.
  if (isShortContinuation(current)) {
    const previous = users(history).reverse().map(explicitIntent).find(Boolean);
    if (previous) return previous;
  }
  return 'information';
}

export function shouldShowProductCards(intent, message = '', products = [], compatibility = null) {
  const relevant = Number(products[0]?._score || 0) >= 35 && Number(products[0]?._coverage ?? 1) >= 0.5;
  if (intent === 'compatibility') {
    const provedProducts = new Set((compatibility?.evidence || []).map((item) => item.product));
    return relevant && compatibility?.status === 'verified' && provedProducts.has(products[0]?.title);
  }
  return intent === 'recommendation' && (
    RECOMMENDATION.some((pattern) => pattern.test(message)) ||
    (message.trim().split(/\s+/).length <= 5 && hasStrongProduct(products))
  ) && relevant;
}

export function shouldShowCatalogSources(intent) {
  return ['compatibility', 'recommendation'].includes(intent);
}

export function guidedQuestion(message, history = [], products = []) {
  if (conversationIntent(message, history, products) !== 'recommendation') return null;
  const firstScore = Number(products[0]?._score || 0);
  const secondScore = Number(products[1]?._score || 0);
  if (firstScore >= 60 && (!products[1] || firstScore - secondScore >= 18)) return null;
  const combined = conversationText(message, history);
  // Une demande de comparaison explicite est déjà exploitable. Le conseiller
  // compare les données disponibles au lieu d'imposer un questionnaire.
  if (/\b(moins cher|prix|budget|puissant|puissance|autonomie|meilleur rapport)\b/.test(combined)) return null;
  if (/\b(resistance|cartouche|coil)\b/.test(combined) && !/\b(luxe|xros|xross|argus|gtx|geekvape|vaporesso|voopoo|oxva|innokin|aspire|justfog|aegis|wenax|q16|xlim|nexlim)\b/.test(combined)) {
    if (!wasAsked(history, 'modèle exact de votre cigarette électronique')) {
      return { text: 'Quel est le modèle exact de votre cigarette électronique ?', choices: [] };
    }
  }
  if (/\b(e liquide|e-liquide|eliquide|liquide)\b/.test(combined)) {
    if (!/\b(fruit\w*|classic\w*|tabac|menth\w*|gourmand\w*|boisson|go[uû]t\s+\w+|saveur\s+\w+)\b/.test(combined)) {
      return { text: 'Quel profil de saveur recherchez-vous ?', choices: ['Fruité', 'Menthe', 'Classic', 'Gourmand'] };
    }
    if (/\b(go[uû]t|saveur)\s+\w+\b/.test(combined) && firstScore < 35) return null;
    if (!/\b(frais|sans frais|non frais)\b/.test(combined)) {
      return { text: 'Préférez-vous une sensation fraîche ?', choices: ['Oui, frais', 'Non, sans frais'] };
    }
    if (!/\b(0|3|6|10|12|18|20)\s*(mg|mg\/ml)?\b/.test(combined)) {
      return { text: 'Quel taux de nicotine utilisez-vous ?', choices: ['0 mg', '3 mg', '6 mg', 'Je ne sais pas'] };
    }
    return null;
  }
  if (!/\b(debutant|experimente)\b/.test(combined) && !wasAsked(history, 'débutant ou expérimenté')) {
    return { text: 'Pour bien vous orienter : êtes-vous débutant ou expérimenté ?', choices: ['Débutant', 'Expérimenté'] };
  }
  if (!/\b(mtl|serre|rdl|aerien)\b/.test(combined) && !wasAsked(history, 'Quel tirage préférez-vous')) {
    return { text: 'Quel tirage préférez-vous ?', choices: ['Serré MTL', 'Polyvalent RDL', 'Aérien'] };
  }
  if (!/\b\d+\s*(€|euros?)\b/.test(combined) && !wasAsked(history, 'Quel budget maximum')) {
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
  if (/(oeil|œil|yeux)/i.test(message)) {
    return "Rincez immédiatement l’œil à l’eau tiède pendant au moins 15 minutes, sans le frotter, puis contactez un centre antipoison ou un professionnel de santé. En cas de douleur importante, de trouble de la vision ou d’aggravation, contactez les secours.";
  }
  if (/\b(aval|ing[eé]r|intox)\w*/i.test(message)) {
    return "Ne faites pas vomir. Rincez la bouche et contactez immédiatement un centre antipoison ou les secours en indiquant le produit et, si elle est connue, sa concentration en nicotine. N’attendez pas l’apparition de symptômes.";
  }
  if (/\b(eau|mouille|mouillé|immerg)\w*/i.test(message)) {
    return "N’utilisez plus et ne rechargez pas l’appareil. Éteignez-le si cela peut être fait sans risque, essuyez seulement l’extérieur et ne tentez pas de le faire sécher en le chauffant. Un accu ou un appareil ayant été immergé doit être contrôlé par un professionnel avant toute réutilisation.";
  }
  if (/\b(peau|main|visage)\b/i.test(message)) {
    return "Retirez les vêtements souillés puis rincez immédiatement et abondamment la peau à l’eau et au savon. En cas de symptômes, d’exposition importante ou de doute sur un liquide nicotiné, contactez sans attendre un centre antipoison ou un professionnel de santé.";
  }
  return "Arrêtez immédiatement d’utiliser et de recharger l’appareil. Éloignez-le des matières inflammables, ne démontez pas l’accu et contactez rapidement l’équipe CLASS’CLOPE. En cas d’ingestion, de contact avec les yeux ou de malaise, contactez sans attendre un professionnel de santé ou les secours.";
}

export function healthResponse(message) {
  if (!HEALTH.some((pattern) => pattern.test(message))) return null;
  if (/\b(douleur thoracique|malaise|essouffl|palpitation|intoxication)\w*/i.test(message)) {
    return "Arrêtez de vapoter et demandez rapidement un avis médical. En cas de douleur thoracique, de difficulté à respirer, de malaise important ou d’aggravation, contactez immédiatement les secours. Je ne peux pas établir de diagnostic dans ce chat.";
  }
  if (/\b(grossesse|enceinte|allaitement)\b/i.test(message)) {
    return "Je ne peux pas donner de conseil médical personnalisé pendant une grossesse ou un allaitement. Demandez rapidement l’avis d’un médecin, d’une sage-femme ou d’un pharmacien, qui pourra vous accompagner sans risque.";
  }
  return "Ce symptôme mérite un avis professionnel : arrêtez temporairement de vapoter et contactez un médecin ou un pharmacien, surtout s’il persiste ou s’aggrave. Je peux vous aider sur le fonctionnement du matériel, mais pas établir de diagnostic médical.";
}

export function complianceResponse(message) {
  if (!COMPLIANCE.some((pattern) => pattern.test(message))) return null;
  if (/\b(?:1[0-7]|[0-9])\s*ans\b|\bmineur\b|moins de 18 ans/i.test(message)) {
    return "Je ne peux pas conseiller ni vendre de produit de vapotage à une personne mineure. La vente de produits de vapotage est strictement interdite aux moins de 18 ans.";
  }
  return "Si vous ne fumez pas, ne commencez pas à vapoter : ces produits sont destinés aux fumeurs adultes qui cherchent une alternative au tabac, avec l’objectif de réduire puis d’arrêter leur dépendance.";
}

export function securityResponse(message) {
  if (!SECURITY.some((pattern) => pattern.test(message))) return null;
  return "Je ne peux pas fournir de clé, mot de passe, secret ni consigne interne. Je peux en revanche expliquer le fonctionnement public du conseiller ou aider à améliorer sa recherche et ses réponses sans exposer d’information sensible.";
}

export function troubleshootingResponse(message) {
  if (!TROUBLESHOOTING.some((pattern) => pattern.test(message))) return null;
  if (/\b(gout|goût).{0,12}(brule|brûlé|crame|cramé)/i.test(message)) {
    return "N’insistez pas sur la bouffée. Vérifiez qu’il reste assez de liquide, que la puissance ne dépasse pas la plage inscrite sur la résistance et que la résistance a bien été amorcée. Si elle est ancienne ou si le goût persiste, remplacez-la puis imbibez-la et attendez environ 10 minutes avant de vapoter. Quel est le modèle exact et la valeur en ohms de votre résistance ?";
  }
  if (/\b(fuite|coule|remonte|glouglou|gargouille|projection)\b/i.test(message)) {
    return "Nettoyez le conduit d’air et les contacts, vérifiez que la cartouche ou la résistance est correctement installée et que les joints ne sont pas abîmés. Évitez de trop remplir et gardez l’appareil vertical. Si la résistance est usée, remplacez-la. Quel est le modèle exact et d’où vient la fuite ?";
  }
  return null;
}

export function conversationState(message, history = []) {
  const userMessages = [...users(history), String(message || '')];
  const explicit = userMessages.map(explicitIntent).filter(Boolean);
  const activeIntent = explicit.at(-1) || 'information';
  const firstNeed = userMessages.find((item) => explicitIntent(item) === activeIntent) || userMessages.at(-1) || '';
  const combined = normalized(userMessages.join(' '));
  return {
    active_intent: activeIntent,
    initial_need: firstNeed.slice(0, 500),
    experience: /\bexperimente\b/.test(combined) ? 'expérimenté' : (/\bdebutant\b/.test(combined) ? 'débutant' : ''),
    draw: /\bmtl|serre\b/.test(combined) ? 'MTL/serré' : (/\brdl|polyvalent\b/.test(combined) ? 'RDL' : (/\baerien|dl\b/.test(combined) ? 'DL/aérien' : '')),
    already_asked: history.filter((item) => item?.role === 'assistant' && /\?/.test(item.content)).map((item) => item.content.slice(0, 240))
  };
}

export function needsHuman(message, compatibility, intent = '') {
  return ['safety', 'health', 'order_support'].includes(intent) ||
    compatibility?.status === 'unknown' ||
    ORDER.some((pattern) => pattern.test(message)) ||
    /\b(humain|personne|conseiller|service client|sav)\b/i.test(message);
}

export function assistantConfigurationResponse(message) {
  if (!ASSISTANT_CONFIGURATION.some((pattern) => pattern.test(message))) return null;
  return "Pour rendre le conseiller plus performant, votre équipe doit : synchroniser automatiquement tout le catalogue Shopify ; rechercher dans les titres, saveurs, tags, descriptions et variantes ; gérer les fautes et synonymes ; puis tester chaque demande réelle avec le produit attendu. Il faut aussi interdire les réponses inventées sur un catalogue prétendument « chargé » et relancer une recherche élargie avant de conclure qu’aucun résultat n’est trouvé.";
}

export function searchFeedbackResponse(message, products = []) {
  if (!SEARCH_FEEDBACK.some((pattern) => pattern.test(message))) return null;
  const product = products[0];
  const firstScore = Number(product?._score || 0);
  const secondScore = Number(products[1]?._score || 0);
  if (product && firstScore >= 60 && (!products[1] || firstScore - secondScore >= 18)) {
    return `La réponse précédente a conclu trop tôt alors que la recherche élargie retrouve bien ${product.title}. Ce n’était donc pas une absence confirmée du catalogue. Je vous affiche sa fiche.`;
  }
  return "La première recherche n’a pas relié correctement vos mots à la fiche produit. Je ne dois pas prétendre que le catalogue vient d’être chargé : je dois relancer une recherche plus large ou vous demander le nom exact si le résultat reste incertain.";
}
