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
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table profiles enable row level security;
alter table items enable row level security;
alter table messages enable row level security;

-- profiles : chacun voit tous les profils publics, mais ne modifie que le sien
create policy "Profils visibles par tous" on profiles for select using (true);
create policy "Modifier son propre profil" on profiles for update using (auth.uid() = id);
create policy "Creer son propre profil" on profiles for insert with check (auth.uid() = id);

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
