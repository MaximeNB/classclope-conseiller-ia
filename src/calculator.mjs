function normalized(value = '') {
  return String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(',', '.');
}

function numberBefore(text, unit) {
  const match = text.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unit}`, 'i'));
  return match ? Number(match[1].replace(',', '.')) : null;
}

export function diyCalculationResponse(message, shopBaseUrl) {
  const text = normalized(message);
  const asksBoosters = /\b(booster|boosters|nicotine|mg\/ml)\b/.test(text) && /\b(combien|calcul|quantite|nombre|pour)\b/.test(text);
  if (!asksBoosters) return null;

  const volume = numberBefore(text, '(?:ml|millilitres?)');
  const targetMatch = text.match(/(?:a|à|en|taux de)\s*(\d+(?:[.,]\d+)?)\s*(?:mg(?:\/ml)?)/i) || text.match(/(\d+(?:[.,]\d+)?)\s*mg(?:\/ml)?/i);
  const target = targetMatch ? Number(targetMatch[1].replace(',', '.')) : null;
  const strengthMatch = text.match(/booster(?:s)?(?:\s+de|\s+dose(?:s)?\s+a)?\s*(\d+(?:[.,]\d+)?)\s*mg/i);
  const boosterStrength = strengthMatch ? Number(strengthMatch[1].replace(',', '.')) : 20;

  if (!volume || target === null || target < 0 || boosterStrength <= 0 || target > boosterStrength) return null;
  if (target === 0) {
    return {
      text: `Pour ${volume} ml à 0 mg/ml, aucun booster nicotiné n’est nécessaire.`,
      link: { label: 'Ouvrir le calculateur DIY', url: new URL('/pages/calculateur-diy', shopBaseUrl).toString() }
    };
  }

  const boosterMl = (target * volume) / boosterStrength;
  const bottles = boosterMl / 10;
  const baseMl = Math.max(0, volume - boosterMl);
  const format = (number) => Number(number.toFixed(2)).toLocaleString('fr-FR');
  const bottleText = Number.isInteger(bottles)
    ? `${format(bottles)} flacon${bottles > 1 ? 's' : ''} de 10 ml`
    : `${format(bottles)} flacon de 10 ml, soit ${format(boosterMl)} ml mesurés`;
  return {
    text: `Pour obtenir ${format(volume)} ml à ${format(target)} mg/ml avec des boosters à ${format(boosterStrength)} mg/ml, il faut ${format(boosterMl)} ml de booster (${bottleText}) et ${format(baseMl)} ml de liquide sans nicotine au total. Si vous ajoutez aussi un arôme, son volume doit être déduit de la base. Portez des gants lors de la manipulation de nicotine et ne vapez jamais un concentré pur.`,
    link: { label: 'Vérifier dans le calculateur DIY', url: new URL('/pages/calculateur-diy', shopBaseUrl).toString() }
  };
}
