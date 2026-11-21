-- Migration 001 : extensions, schéma privé, types énumérés, utilitaires. Additive uniquement.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext  with schema extensions;

-- Schéma "private" : fonctions internes, NON exposé par l'API REST.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create type public.app_role as enum
  ('member', 'premium', 'creator', 'editor', 'admin', 'super_admin');

-- Provenance d'une donnée : jamais de statistique sans origine.
create type public.data_source as enum ('official', 'imported', 'manual', 'demo');

create type public.match_status as enum
  ('scheduled', 'live', 'finished', 'postponed', 'cancelled');

create type public.verification_status as enum
  ('unverified', 'pending', 'verified', 'rejected');

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
