-- Migration 021 : clé d'import pour l'import CSV en masse (appliquée sous le nom import_keys_for_bulk_import).
-- Un match ou une rediffusion importé porte une référence unique : réimporter le même fichier met à jour au lieu de dupliquer.
alter table public.matches add column if not exists import_key text;
alter table public.vods add column if not exists import_key text;
alter table public.matches add constraint matches_import_key_unique unique (import_key);
alter table public.vods add constraint vods_import_key_unique unique (import_key);
