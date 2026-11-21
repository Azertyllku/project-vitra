-- Migration 003 : catalogue multi-jeux + RLS. Ajouter un jeu = insérer des lignes.

create table public.games (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name         text not null,
  short_name   text,
  description  text,
  genre        text,
  logo_url     text,
  banner_url   text,
  accent_color text check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger games_updated_at before update on public.games
  for each row execute function private.set_updated_at();

create table public.game_modes (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  slug       text not null check (slug ~ '^[a-z0-9-]+$'),
  name       text not null,
  is_ranked  boolean not null default false,
  sort_order int not null default 0,
  unique (game_id, slug)
);

-- Définition des statistiques PAR JEU : chaque jeu a son propre moteur.
create table public.game_statistics_definitions (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references public.games (id) on delete cascade,
  scope          text not null check (scope in ('player_match', 'player_aggregate', 'team_match', 'team_aggregate')),
  key            text not null check (key ~ '^[a-z0-9_]+$'),
  label          text not null,
  value_type     text not null check (value_type in ('integer', 'decimal', 'percentage', 'duration', 'text')),
  unit           text,
  higher_is_better boolean,
  display_order  int not null default 0,
  unique (game_id, scope, key)
);

-- AUCUN secret ici : secret_name référence un secret Vault / Edge Function.
create table public.game_api_integrations (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games (id) on delete cascade,
  provider      text not null,
  status        text not null default 'disabled' check (status in ('disabled', 'active', 'error')),
  capabilities  jsonb not null default '{}'::jsonb,
  rate_limit    jsonb not null default '{}'::jsonb,
  config        jsonb not null default '{}'::jsonb,
  secret_name   text,
  last_synced_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (game_id, provider)
);
create trigger game_api_integrations_updated_at before update on public.game_api_integrations
  for each row execute function private.set_updated_at();

create table public.external_refs (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('game', 'player', 'team', 'tournament', 'match', 'stream')),
  entity_id   uuid not null,
  provider    text not null,
  external_id text not null,
  created_at  timestamptz not null default now(),
  unique (provider, entity_type, external_id)
);
create index external_refs_entity on public.external_refs (entity_type, entity_id);

alter table public.games                      enable row level security;
alter table public.game_modes                 enable row level security;
alter table public.game_statistics_definitions enable row level security;
alter table public.game_api_integrations      enable row level security;
alter table public.external_refs              enable row level security;

do $$
declare t text;
begin
  foreach t in array array['games', 'game_modes', 'game_statistics_definitions'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_staff()))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_admin_delete', t);
  end loop;
end $$;

create policy game_api_integrations_admin on public.game_api_integrations for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy external_refs_staff_read on public.external_refs for select to authenticated
  using ((select private.is_staff()));
create policy external_refs_admin_write on public.external_refs for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
