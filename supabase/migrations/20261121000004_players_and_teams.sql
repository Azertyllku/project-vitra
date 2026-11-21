-- Migration 004 : joueurs, équipes, effectifs, historique + RLS

create table public.players (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid unique references public.profiles (id) on delete set null,
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  nickname        text not null,
  real_name       text,
  country_code    char(2),
  photo_url       text,
  banner_url      text,
  bio             text,
  socials         jsonb not null default '{}'::jsonb,
  is_professional boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index players_nickname_trgm on public.players using gin (nickname extensions.gin_trgm_ops);
create trigger players_updated_at before update on public.players
  for each row execute function private.set_updated_at();

create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name         text not null,
  tag          text,
  country_code char(2),
  logo_url     text,
  banner_url   text,
  description  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index teams_name_trgm on public.teams using gin (name extensions.gin_trgm_ops);
create trigger teams_updated_at before update on public.teams
  for each row execute function private.set_updated_at();

-- Effectifs datés : servent aussi d'historique des transferts.
create table public.team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  game_id   uuid not null references public.games (id),
  role      text not null default 'player' check (role in ('player', 'substitute', 'coach', 'analyst', 'manager')),
  joined_at date not null default current_date,
  left_at   date,
  check (left_at is null or left_at >= joined_at)
);
create index team_members_team on public.team_members (team_id) where left_at is null;
create index team_members_player on public.team_members (player_id, joined_at desc);

create table public.team_history (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  event_type  text not null check (event_type in ('founded', 'rebrand', 'transfer_in', 'transfer_out', 'title', 'other')),
  event_date  date not null,
  description text,
  metadata    jsonb not null default '{}'::jsonb
);
create index team_history_team on public.team_history (team_id, event_date desc);

create table public.team_statistics (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  game_id     uuid not null references public.games (id) on delete cascade,
  period      text not null check (period in ('7d', '30d', '90d', '6m', '1y', 'career', 'season')),
  season_key  text not null default '',
  metrics     jsonb not null default '{}'::jsonb,
  data_source public.data_source not null,
  computed_at timestamptz not null default now(),
  unique (team_id, game_id, period, season_key)
);

create or replace function private.can_view_player(_player uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.players pl
    left join public.profiles pr on pr.id = pl.profile_id
    where pl.id = _player
      and (
        (pl.is_active and (pl.profile_id is null or pr.is_public))
        or pl.profile_id = (select auth.uid())
      )
  ) or private.is_staff()
$$;

alter table public.players         enable row level security;
alter table public.teams           enable row level security;
alter table public.team_members    enable row level security;
alter table public.team_history    enable row level security;
alter table public.team_statistics enable row level security;

create policy players_select on public.players for select to anon, authenticated
  using ((select private.can_view_player(id)));
create policy players_insert on public.players for insert to authenticated
  with check ((select private.is_staff())
              or (profile_id = (select auth.uid()) and is_professional = false));
create policy players_update on public.players for update to authenticated
  using ((select private.is_staff())
         or (profile_id = (select auth.uid()) and is_professional = false))
  with check ((select private.is_staff())
              or (profile_id = (select auth.uid()) and is_professional = false));
create policy players_delete on public.players for delete to authenticated
  using ((select private.is_admin()));

do $$
declare t text;
begin
  foreach t in array array['teams', 'team_members', 'team_history', 'team_statistics'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_staff()))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_admin_delete', t);
  end loop;
end $$;
