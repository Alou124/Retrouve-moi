# RetrouveMoi — SaaS de retrouvailles d'objets perdus

## Stack
- HTML + Bootstrap 5 + JavaScript vanilla
- Supabase (Auth + Base de données Postgres + Storage)
- SaaSPay (paiement de l'abonnement premium)
- Vercel (hébergement)

## Structure du projet
```
objets-perdus-saas/
├── index.html              # Landing page
├── vercel.json              # Config déploiement Vercel
├── .env.example              # Variables d'environnement (à copier en .env)
├── assets/
│   ├── css/style.css        # Styles personnalisés
│   ├── js/supabaseClient.js # Connexion Supabase + fonctions helpers
│   └── img/                 # Images statiques
├── pages/                   # Pages internes (à créer à l'étape suivante)
│   ├── inscription.html
│   ├── connexion.html
│   ├── declarer.html
│   ├── annonces.html
│   ├── annonce-detail.html
│   ├── dashboard.html
│   └── premium.html
└── supabase/
    └── schema.sql            # Script SQL complet (tables + RLS + storage)
```

## Mise en route

### 1. Créer le projet Supabase
1. Va sur https://supabase.com et crée un nouveau projet.
2. Dans **SQL Editor**, colle et exécute le contenu de `supabase/schema.sql`.
3. Vérifie dans **Storage** que le bucket `photos-objets` a bien été créé (public).
4. Récupère ton `Project URL` et ta clé `anon public` dans **Project Settings > API**.
5. Colle-les dans `assets/js/supabaseClient.js` (variables `SUPABASE_URL` et `SUPABASE_ANON_KEY`).

### 2. Tester en local
Ouvre simplement `index.html` dans un navigateur, ou lance un petit serveur local :
```bash
npx serve .
```

### 3. Déployer sur Vercel
```bash
npm i -g vercel
vercel
```
Vercel détecte automatiquement un site statique grâce à `vercel.json`.

### 4. Intégrer SaaSPay (étape suivante)
La page `pages/premium.html` contiendra le bouton d'abonnement SaaSPay, avec un webhook qui mettra à jour la table `subscriptions` côté Supabase.

## Tables de la base de données
| Table | Rôle |
|---|---|
| `profiles` | Infos complémentaires utilisateur (nom, ville, statut premium) |
| `items` | Annonces d'objets perdus/trouvés |
| `messages` | Messages entre utilisateurs pour la mise en relation |
| `subscriptions` | Statut de l'abonnement premium (SaaSPay) |

## Système de paiement à la recherche (1ère gratuite, puis 25 FCFA)

### Comment ça marche
- Chaque profil a `recherche_gratuite_utilisee` (bool) et `credits_recherche` (int)
- La fonction SQL `consommer_recherche()` décide si la recherche est autorisée
- Si le quota est épuisé → une modale s'affiche avec un bouton de paiement
- Le paiement passe par 2 fonctions serveur Vercel (`/api/creer-paiement` et `/api/webhook-saaspay`),
  **jamais directement depuis le navigateur** (les clés secrètes SaaSPay ne doivent jamais
  être exposées côté client)

### Variables à configurer sur Vercel
Dans **Vercel > ton projet > Settings > Environment Variables**, ajoute :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (trouvable dans Supabase > Settings > API — **jamais** dans le JS client)
- `SAASPAY_SECRET_KEY`
- `SAASPAY_WEBHOOK_SECRET`
- `SITE_URL`

### ⚠️ À adapter impérativement
Je n'ai pas trouvé de documentation publique vérifiable pour "SaaSPay" au moment de la
rédaction. Le code dans `api/creer-paiement.js` et `api/webhook-saaspay.js` est un
**squelette générique** (structure classique : créer un paiement → rediriger → recevoir
un webhook). Avant de mettre en production, va sur ton dashboard SaaSPay / leur doc
développeur et vérifie :
1. L'URL exacte de l'endpoint de création de paiement (`https://api.saaspay.com/v1/payments` est un exemple)
2. Le nom exact des champs attendus (`amount`, `currency`, `reference`... peuvent différer)
3. La méthode de vérification du webhook (header de signature, secret partagé, etc.)
4. Le nom du champ renvoyé pour l'URL de paiement (`payment_url` vs `checkout_url`)

Si tu me donnes un extrait de leur doc ou un exemple de requête/réponse, j'ajuste le code précisément.

### Installer les dépendances avant de déployer
```bash
npm install
```

## Prochaines étapes suggérées
- ✅ inscription.html / connexion.html
- ✅ declarer.html (formulaire + upload photo)
- ✅ annonces.html (liste + filtres + quota de recherche)
- ✅ annonce-detail.html (détail + messagerie)
- ✅ dashboard.html (mes annonces + messages reçus + quota)
- ⏳ Brancher les vraies clés Supabase et SaaSPay avant mise en production
- ⏳ Espace admin (modération des annonces)
