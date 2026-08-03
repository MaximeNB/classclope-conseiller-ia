# Conseiller IA CLASS'CLOPE

## Version 2.4 — Catalogue fiable

Le contenu de cette archive doit être téléversé directement à la racine du dépôt GitHub. `package.json`, `src`, `data`, `scripts` et `test` doivent apparaître immédiatement, sans dossier V2 supplémentaire.

- priorité stricte : sécurité, santé, dépannage, commande/SAV, compatibilité, information, recommandation ;
- mémoire du parcours pour les réponses courtes ;
- suivi de commande via l'espace client et transfert sécurisé pour le SAV ;
- aucune carte commerciale pendant un dépannage ou une demande de commande ;
- cartes affichées après l'explication et seulement lors d'une intention d'achat explicite ;
- arrêt contrôlé et réponse de secours si un service répond trop lentement.
- priorité immédiate aux références produit explicitement citées ;
- recherche dans le titre, la marque, le type, les tags, la description, les saveurs, les métadonnées et les variantes ;
- tolérance aux variantes `emral`, `emerald` et `emrald` ;
- formulation d'incertitude limitée aux résultats chargés, sans conclure abusivement à une absence sur le site ;
- aucune source produit visible pendant un dépannage, une alerte sécurité ou une question médicale.

Serveur privé du conseiller virtuel de la page Shopify `Conseiller virtuel`.

## Ce qu’il fait

- utilise l’API Responses d’OpenAI sans exposer la clé au navigateur ;
- diffuse la réponse mot par mot ;
- conserve le contexte des derniers échanges transmis par la page ;
- recherche d’abord les produits dans le catalogue CLASS’CLOPE ;
- ne confirme une compatibilité que si le catalogue la contient ;
- revérifie prix, variantes et disponibilité via Shopify avant d’afficher au maximum trois cartes ;
- propose un parcours guidé court et un transfert vers la page Contact ;
- accepte une télémétrie anonyme minimale sur `/api/events` ;
- renvoie des liens vers les fiches pertinentes ;
- limite la taille des requêtes, les origines autorisées et le nombre de demandes.

## Configuration

1. Héberger ce dossier sur un service Node.js 20+ avec HTTPS (Render, Railway, Fly.io, etc.).
2. Copier les variables de `.env.example` dans les variables privées de l’hébergeur.
3. Créer une clé sur la plateforme OpenAI et la définir comme secret `OPENAI_API_KEY`.
4. Définir `ALLOWED_ORIGINS` avec le domaine exact de la boutique.
5. Déployer puis ouvrir `https://VOTRE-SERVEUR/health`.
6. Dans l’éditeur du thème Shopify, ouvrir la section **Conseiller virtuel** et renseigner :

   `https://VOTRE-SERVEUR/api/adviser`

Ne jamais copier la clé OpenAI dans Shopify, un fichier JavaScript, GitHub ou ce chat.

La route publique Shopify `/products/{handle}.js` est utilisée en lecture seule. Si elle est momentanément indisponible, le conseiller affiche « Disponibilité à confirmer » et ne prétend pas connaître le stock.

## Mise à jour du catalogue

Exporter le catalogue Shopify complet, puis exécuter la commande avec l’export complet et, si nécessaire, un second CSV de nouveautés :

```bash
npm run build:catalog -- "/chemin/vers/export-complet.csv" "/chemin/vers/nouveautes.csv"
npm test
```

Redéployer ensuite le serveur. Le fichier `data/catalog.json` est la base de connaissances contrôlée.

## Test local

```bash
cp .env.example .env
set -a
. ./.env
set +a
npm test
npm start
```

Puis :

```bash
curl http://localhost:8787/health
```
