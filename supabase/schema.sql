-- ============================================
-- SCHEMA SQL - SaaS Retrouvailles d'Objets Perdus
-- A exécuter dans Supabase > SQL Editor
-- ============================================

-- Extension pour générer des UUID
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLE : profiles
-- Complète la table auth.users gérée par Supabase Auth
-- ============================================
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  telephone text,
  ville text,
  is_premium boolean default false,
  created_at timestamp with time zone default now()
);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, telephone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'telephone');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- TABLE : items (objets perdus / trouvés)
-- ============================================
create table if not exists items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  titre text not null,
  description text,
  categorie text not null,           -- ex: électronique, clés, papiers, animaux, vêtements...
  statut text not null check (statut in ('perdu', 'trouve', 'restitue')),
  lieu text,
  date_evenement date,
  photo_url text,
  contact_visible boolean default true,
  created_at timestamp with time zone default now()
);

create index if not exists idx_items_statut on items(statut);
create index if not exists idx_items_categorie on items(categorie);
create index if not exists idx_items_user on items(user_id);

-- ============================================
-- TABLE : messages (mise en relation entre utilisateurs)
-- ============================================
create table if not exists messages (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references items(id) on delete cascade not null,
  expediteur_id uuid references auth.users(id) on delete cascade not null,
  destinataire_id uuid references auth.users(id) on delete cascade not null,
  contenu text not null,
  lu boolean default false,
  created_at timestamp with time zone default now()
);

create index if not exists idx_messages_item on messages(item_id);
create index if not exists idx_messages_destinataire on messages(destinataire_id);

-- ============================================
-- QUOTA DE RECHERCHE : 1ère recherche gratuite, puis 25 FCFA/recherche
-- ============================================
alter table profiles add column if not exists recherche_gratuite_utilisee boolean default false;
alter table profiles add column if not exists credits_recherche integer default 0;

-- Historique des paiements de recherche (25 FCFA via SaaSPay)
create table if not exists paiements_recherche (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  montant integer not null default 25,      -- en FCFA
  statut text not null default 'en_attente' check (statut in ('en_attente', 'reussi', 'echoue')),
  reference text unique not null,             -- référence unique envoyée à SaaSPay
  saaspay_transaction_id text,                -- id renvoyé par SaaSPay
  created_at timestamp with time zone default now(),
  paye_at timestamp with time zone
);

create index if not exists idx_paiements_user on paiements_recherche(user_id);
create index if not exists idx_paiements_reference on paiements_recherche(reference);

-- Fonction : consommer une recherche (gratuite ou via crédit payant)
-- Renvoie true si la recherche est autorisée, false si un paiement est requis
create or replace function consommer_recherche(p_user_id uuid)
returns boolean as $$
declare
  v_gratuite_utilisee boolean;
  v_credits integer;
begin
  select recherche_gratuite_utilisee, credits_recherche
    into v_gratuite_utilisee, v_credits
    from profiles where id = p_user_id
    for update; -- verrou pour éviter les doubles décomptes en cas de clics rapides

  if not v_gratuite_utilisee then
    update profiles set recherche_gratuite_utilisee = true where id = p_user_id;
    return true;
  elsif v_credits > 0 then
    update profiles set credits_recherche = credits_recherche - 1 where id = p_user_id;
    return true;
  else
    return false; -- paiement requis
  end if;
end;
$$ language plpgsql security definer;

-- Fonction appelée par le webhook SaaSPay après un paiement confirmé
create or replace function incrementer_credits(p_user_id uuid, p_montant integer default 1)
returns void as $$
begin
  update profiles
  set credits_recherche = credits_recherche + p_montant
  where id = p_user_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- TABLE : subscriptions (abonnement premium via SaaSPay)
-- ============================================
create table if not exists subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  plan text not null default 'premium',
  statut text not null check (statut in ('actif', 'expire', 'annule')),
  saaspay_reference text,
  date_debut timestamp with time zone default now(),
  date_fin timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table profiles enable row level security;
alter table items enable row level security;
alter table messages enable row level security;
alter table subscriptions enable row level security;

-- profiles : chacun voit tous les profils publics, mais ne modifie que le sien
create policy "Profils visibles par tous" on profiles for select using (true);
create policy "Modifier son propre profil" on profiles for update using (auth.uid() = id);

-- items : visibles par tous, création/modif/suppression réservées au propriétaire
create policy "Annonces visibles par tous" on items for select using (true);
create policy "Creer une annonce si connecte" on items for insert with check (auth.uid() = user_id);
create policy "Modifier ses propres annonces" on items for update using (auth.uid() = user_id);
create policy "Supprimer ses propres annonces" on items for delete using (auth.uid() = user_id);

-- messages : uniquement visibles par expéditeur et destinataire
create policy "Voir ses messages" on messages for select
  using (auth.uid() = expediteur_id or auth.uid() = destinataire_id);
create policy "Envoyer un message" on messages for insert
  with check (auth.uid() = expediteur_id);

-- subscriptions : chacun ne voit que son propre abonnement
create policy "Voir son abonnement" on subscriptions for select using (auth.uid() = user_id);

-- paiements_recherche : chacun ne voit que ses propres paiements
alter table paiements_recherche enable row level security;
create policy "Voir ses paiements" on paiements_recherche for select using (auth.uid() = user_id);
-- Note : les insert/update sur paiements_recherche se font UNIQUEMENT depuis les
-- fonctions serveur (api/creer-paiement.js et api/webhook-saaspay.js) avec la
-- clé service_role, jamais depuis le navigateur. Pas de policy insert/update ici.

-- ============================================
-- STORAGE : bucket pour les photos d'objets
-- (à créer aussi manuellement dans Dashboard > Storage si besoin)
-- ============================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos-objets', 'photos-objets', true,
  5242880, -- 5 Mo max
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

create policy "Photos visibles par tous"
  on storage.objects for select using (bucket_id = 'photos-objets');

create policy "Upload si connecte"
  on storage.objects for insert
  with check (bucket_id = 'photos-objets' and auth.role() = 'authenticated');
