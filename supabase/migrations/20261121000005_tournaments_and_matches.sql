-- Migration 005 : tournois, matchs, résultats, événements + RLS

create table public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  organizer   text,
  format      text not null default 'single_elimination'
              check (format in ('single_elimination', 'double_elimination', 'round_robin', 'swiss', 'groups_playoffs', 'battle_royale', 'other')),
  status      text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'finished', 'cancelled')),
  region      text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  prize_pool  numeric(14, 2) check (prize_pool >= 0),
  currency    char(3) default 'USD',
  logo_url    text,
  banner_url  text,
  description text,
  data_source public.data_source not null default 'manual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
create index tournaments_game_status on public.tournaments (game_id, status, starts_at desc);
create index tournaments_name_trgm on public.tournaments using gin (name extensions.gin_trgm_ops);
create trigger tournaments_updated_at before update on public.tournaments
  for each row execute function private.set_updated_at();

create table public.tournament_stages (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name          text not null,
  stage_order   smallint not null default 1,
  stage_type    text not null default 'bracket' check (stage_type in ('groups', 'bracket', 'double_bracket', 'swiss', 'league')),
  unique (tournament_id, stage_order)
);

create table public.tournament_groups (
  id       uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.tournament_stages (id) on delete cascade,
  name     text not null,
  unique (stage_id, name)
);

create table public.tournament_participants (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  team_id       uuid not null references public.teams (id) on delete cascade,
  group_id      uuid references public.tournament_groups (id) on delete set null,
  seed          int,
  placement     int,
  prize         numeric(14, 2) check (prize >= 0),
  primary key (tournament_id, team_id)
);
create index tournament_participants_team on public.tournament_participants (team_id);

create table public.tournament_rankings (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  stage_id      uuid references public.tournament_stages (id) on delete cascade,
  group_id      uuid references public.tournament_groups (id) on delete cascade,
  team_id       uuid not null references public.teams (id) on delete cascade,
  rank          int not null,
  points        numeric not null default 0,
  wins          int not null default 0,
  losses        int not null default 0,
  details       jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);
create index tournament_rankings_lookup on public.tournament_rankings (tournament_id, stage_id, group_id, rank);

create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games (id),
  tournament_id uuid references public.tournaments (id) on delete set null,
  stage_id      uuid references public.tournament_stages (id) on delete set null,
  status        public.match_status not null default 'scheduled',
  scheduled_at  timestamptz,
  started_at    timestamptz,
  ended_at      timestamptz,
  best_of       smallint check (best_of between 1 and 9),
  round_label   text,
  data_source   public.data_source not null default 'manual',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index matches_game_schedule on public.matches (game_id, scheduled_at desc);
create index matches_tournament on public.matches (tournament_id, scheduled_at);
create index matches_live on public.matches (game_id) where status = 'live';
create trigger matches_updated_at before update on public.matches
  for each row execute function private.set_updated_at();

create table public.match_teams (
  match_id          uuid not null references public.matches (id) on delete cascade,
  slot              smallint not null check (slot >= 1),
  team_id           uuid references public.teams (id) on delete set null,
  placeholder_label text,
  score             int,
  placement         int,
  is_winner         boolean,
  primary key (match_id, slot)
);
create unique index match_teams_unique_team on public.match_teams (match_id, team_id) where team_id is not null;
create index match_teams_team on public.match_teams (team_id, match_id);

create table public.match_players (
  match_id  uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  team_id   uuid references public.teams (id) on delete set null,
  primary key (match_id, player_id)
);
create index match_players_player on public.match_players (player_id);

create table public.match_results (
  match_id       uuid primary key references public.matches (id) on delete cascade,
  winner_team_id uuid references public.teams (id) on delete set null,
  summary        jsonb not null default '{}'::jsonb,
  maps           jsonb not null default '[]'::jsonb,
  finalized_at   timestamptz
);

create table public.match_statistics (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  game_id    uuid not null references public.games (id),
  player_id  uuid references public.players (id) on delete cascade,
  team_id    uuid references public.teams (id) on delete cascade,
  map_number smallint not null default 0,
  stats      jsonb not null default '{}'::jsonb,
  data_source public.data_source not null,
  created_at timestamptz not null default now(),
  check (player_id is not null or team_id is not null)
);
create index match_statistics_match on public.match_statistics (match_id);
create index match_statistics_player on public.match_statistics (player_id, game_id);

create table public.match_events (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.matches (id) on delete cascade,
  event_type  text not null,
  occurred_at timestamptz not null default now(),
  payload     jsonb not null default '{}'::jsonb
);
create index match_events_match on public.match_events (match_id, id);

do $$
declare t text;
begin
  foreach t in array array[
    'tournaments', 'tournament_stages', 'tournament_groups', 'tournament_participants',
    'tournament_rankings', 'matches', 'match_teams', 'match_players',
    'match_results', 'match_statistics', 'match_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_staff()))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_admin_delete', t);
  end loop;
end $$;
