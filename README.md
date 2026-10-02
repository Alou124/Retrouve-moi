# RetrouveMoi — SaaS de retrouvailles d'objets perdus

## Stack
- HTML + Bootstrap 5 + JavaScript vanilla
- Supabase (Auth + Base de données Postgres + Storage)
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
│   └── dashboard.html
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

## Tables de la base de données
| Table | Rôle |
|---|---|
| `profiles` | Infos complémentaires utilisateur (nom, téléphone, ville) |
| `items` | Annonces d'objets perdus/trouvés |
| `messages` | Messages entre utilisateurs pour la mise en relation |

## Recherche
La recherche est gratuite et illimitée, sans paiement.

> Si tu avais déjà exécuté l'ancien `schema.sql`, exécute aussi `supabase/retirer-paiement.sql` une fois dans Supabase.
> Si les numéros de téléphone ne s'enregistrent pas, exécute aussi `supabase/fix-telephone.sql` une fois dans Supabase.

## Prochaines étapes suggérées
- ✅ inscription.html / connexion.html
- ✅ declarer.html (formulaire + upload photo)
- ✅ annonces.html (liste + filtres)
- ✅ annonce-detail.html (détail + messagerie)
- ✅ dashboard.html (mes annonces + messages reçus)
- ⏳ Brancher les vraies clés Supabase avant mise en production
- ⏳ Espace admin (modération des annonces)
