-- A exécuter UNE FOIS dans Supabase > SQL Editor
-- Répare l'enregistrement des numéros de téléphone.

-- 1. S'assurer que la colonne existe
alter table profiles add column if not exists telephone text;

-- 2. Autoriser un utilisateur à créer son propre profil (nécessaire pour upsert)
drop policy if exists "Creer son propre profil" on profiles;
create policy "Creer son propre profil" on profiles
  for insert with check (auth.uid() = id);

-- 3. Recréer le trigger qui crée le profil à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, telephone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'telephone')
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        telephone = coalesce(excluded.telephone, public.profiles.telephone);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Créer les profils manquants des comptes déjà existants
insert into public.profiles (id, full_name, telephone)
select u.id, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'telephone'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 5. Récupérer les numéros saisis à l'inscription mais absents du profil
update public.profiles p
set telephone = u.raw_user_meta_data->>'telephone'
from auth.users u
where p.id = u.id
  and (p.telephone is null or p.telephone = '')
  and coalesce(u.raw_user_meta_data->>'telephone','') <> '';
