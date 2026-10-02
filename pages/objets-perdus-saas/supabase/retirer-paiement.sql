-- A exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- si tu avais déjà exécuté l'ancien schema.sql (avec paiements).
-- Supprime tout ce qui concerne le paiement et le quota de recherche.

drop function if exists consommer_recherche(uuid);
drop function if exists incrementer_credits(uuid, integer);
drop table if exists paiements_recherche;
drop table if exists subscriptions;
alter table profiles drop column if exists recherche_gratuite_utilisee;
alter table profiles drop column if exists credits_recherche;
alter table profiles drop column if exists is_premium;
