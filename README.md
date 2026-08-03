# Conseiller IA CLASS’CLOPE

## Version 3.1 — Expert fiable

Ce paquet contient uniquement le backend Node.js du conseiller. Il ne modifie ni le thème Shopify, ni le design, ni le sélecteur guidé, ni les calculateurs du site.

La V3.1 combine trois couches :

1. **Réponses déterministes** pour les sujets qui ne doivent pas être improvisés : sécurité, santé, mineurs, secrets, commande/SAV, livraison, retours, paiements, boutiques, calculs de boosters et dépannage courant.
2. **Recherche hybride Shopify** : catalogue enrichi embarqué, suggestions Shopify, puis catalogue public complet. Les comparatifs prix/puissance/autonomie forcent la vérification du catalogue complet.
3. **GPT-5.6 Sol** pour comprendre les demandes ouvertes, tenir une conversation naturelle et expliquer les compromis à partir des seules données fournies par le backend.

## Corrections principales

- Tonka, Emrald Slash et variantes orthographiques conservés ;
- boucle « Expérimenté » supprimée et état conversationnel explicite ;
- comparatifs reconnus comme recommandations, avec contrôle Shopify en direct ;
- familles produit strictes : pod, matériel, puff, liquide, concentré, cartouche et résistance ne sont plus mélangés ;
- préférences négatives comprises, notamment « pas frais » ;
- aucune carte si la correspondance n’est pas pertinente ;
- compatibilités prouvées à partir des deux côtés de la relation produit ;
- Luxe X3 ne provoque plus de fausse recommandation GTX ;
- base officielle pour livraison, retours, paiement, contact et boutiques ;
- calcul fiable des boosters nicotinés ;
- réponses immédiates pour mineurs, non-fumeurs, exposition au liquide, accu mouillé et symptômes ;
- protections contre l’extraction de clé ou de consignes internes ;
- dernier delta OpenAI préservé même si le flux se termine sans séparateur final ;
- une relance courte sur les erreurs OpenAI transitoires ;
- nettoyage périodique des compteurs de limitation ;
- validation stricte de l’URL de page transmise par Shopify.

## Déploiement Render

Téléversez **le contenu de cette archive directement à la racine** du dépôt GitHub relié à Render. La racine doit contenir `package.json`, `src`, `data`, `scripts` et `test`, sans dossier parent V3.1.

Réglages Render :

- Build Command : `npm install`
- Start Command : `npm start`
- Health Check Path : `/health`
- Runtime : Node.js 20 ou plus récent

Variables :

```text
OPENAI_API_KEY=secret_existant
OPENAI_MODEL=gpt-5.6-sol
OPENAI_REASONING_EFFORT=medium
OPENAI_MAX_OUTPUT_TOKENS=1100
SHOP_BASE_URL=https://www.classclope.fr
ALLOWED_ORIGINS=https://www.classclope.fr,https://classclope.fr
MAX_REQUESTS_PER_5_MINUTES=25
REQUEST_TIMEOUT_MS=25000
SHOPIFY_CACHE_SECONDS=45
SHOPIFY_CATALOG_CACHE_SECONDS=600
```

Ne définissez pas `PORT` manuellement sur Render. Ne placez jamais `OPENAI_API_KEY` dans Shopify, GitHub ou le navigateur.

Après déploiement, `/health` doit afficher :

```json
"version": "3.1.0-expert-fiable"
```

Le modèle par défaut est `gpt-5.6-sol`, choisi pour la qualité maximale. Pour réduire le coût et la latence, `gpt-5.6-terra` reste une alternative compatible, avec une baisse potentielle de qualité sur les cas conversationnels complexes.

## Validation locale

```bash
npm test
OPENAI_API_KEY=test npm start
```

Puis :

```bash
curl http://localhost:8787/health
```

Les routes déterministes restent capables de répondre si OpenAI est momentanément indisponible. Les demandes ouvertes qui nécessitent le modèle renvoient alors une erreur contrôlée.

## Données et maintenance

### Catalogue

Le fichier `data/catalog.json` contient les caractéristiques enrichies. Le serveur récupère également le catalogue Shopify public en direct et le met en cache dix minutes.

Pour régénérer le catalogue enrichi à partir d’un export Shopify :

```bash
npm run build:catalog -- "/chemin/export-complet.csv" "/chemin/nouveautes.csv"
npm test
```

### Base de connaissances

`data/knowledge.json` contient les faits commerciaux officiels vérifiés le 3 août 2026 : livraison, retours, paiements, contact et boutiques. Si une politique change sur le site, mettez à jour ce fichier puis rejouez les tests avant déploiement.

## Limites assumées

Le conseiller ne peut pas lire une commande privée, décider d’un remboursement, confirmer un stock sans réponse Shopify, inventer une compatibilité, poser un diagnostic médical ou promettre un geste commercial. Dans ces cas, il explique la limite et oriente vers le canal humain approprié.
