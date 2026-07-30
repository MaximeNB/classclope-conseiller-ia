const VAGUE_PATTERNS = [
  /\b(aidez|aide|conseil|conseillez|choisir|recommande|cherche)\b.{0,35}\b(kit|pod|cigarette|materiel)\b/i,
  /\b(e liquide|eliquide|liquide)\b.{0,25}\b(adapte|choisir|conseil|cherche)\b/i
];

export function guidedQuestion(message, history = []) {
  const combined = [...history.filter((item) => item.role === 'user').map((item) => item.content), message].join(' ').toLowerCase();
  if (!VAGUE_PATTERNS.some((pattern) => pattern.test(message))) return null;
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

export function needsHuman(message, compatibility) {
  return compatibility.status === 'unknown' ||
    /\b(humain|personne|conseiller|commande|livraison|retour|remboursement|medical|médical|grossesse|allaitement)\b/i.test(message);
}
