-- Migration 013 : phase 5 — tracker de performances.

-- (1) Unicité des comptes de jeux : une déclaration non vérifiée ne doit pas pouvoir "squatter" un identifiant.
--     L'unicité globale ne s'applique qu'aux comptes vérifiés ; un membre ne peut pas dupliquer son propre compte.
alter table public.player_game_accounts drop constraint if exists player_game_accounts_game_id_provider_external_id_key;
create unique index player_game_accounts_verified_unique
  on public.player_game_accounts (game_id, provider, external_id) where verification_status = 'verified';
create unique index player_game_accounts_per_profile
  on public.player_game_accounts (profile_id, game_id, provider, external_id);

-- (2) Journal des synchronisations (écrit uniquement par les Edge Functions via service_role).
create table public.data_sync_logs (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid references public.player_game_accounts (id) on delete cascade,
  profile_id     uuid references public.profiles (id) on delete cascade,
  provider       text not null,
  status         text not null check (status in ('running', 'success', 'error')),
  fetched_count  int not null default 0,
  inserted_count int not null default 0,
  error_message  text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);
create index data_sync_logs_account on public.data_sync_logs (account_id, started_at desc);
alter table public.data_sync_logs enable row level security;
create policy data_sync_logs_select on public.data_sync_logs for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_staff()));

-- (3) Définitions de statistiques par match (propres à chaque jeu).
insert into public.game_statistics_definitions (game_id, scope, key, label, value_type, unit, higher_is_better, display_order)
select g.id, 'player_match', v.key, v.label, v.value_type, v.unit, v.better, v.ord
from public.games g
join (values
  ('counter-strike-2', 'kills',      'Kills',         'integer',    null, true,  10),
  ('counter-strike-2', 'deaths',     'Morts',         'integer',    null, false, 20),
  ('counter-strike-2', 'assists',    'Assistances',   'integer',    null, true,  30),
  ('counter-strike-2', 'adr',        'ADR',           'decimal',    null, true,  40),
  ('counter-strike-2', 'hs_percent', '% headshots',   'percentage', '%',  true,  50),
  ('counter-strike-2', 'kast',       'KAST',          'percentage', '%',  true,  60),
  ('counter-strike-2', 'rating',     'Rating',        'decimal',    null, true,  70),
  ('league-of-legends', 'kills',     'Kills',         'integer',    null, true,  10),
  ('league-of-legends', 'deaths',    'Morts',         'integer',    null, false, 20),
  ('league-of-legends', 'assists',   'Assistances',   'integer',    null, true,  30),
  ('league-of-legends', 'cs',        'CS',            'integer',    null, true,  40),
  ('league-of-legends', 'gold',      'Or',            'integer',    null, true,  50),
  ('league-of-legends', 'vision_score','Score de vision','integer', null, true,  60),
  ('valorant', 'kills',      'Kills',         'integer',    null, true,  10),
  ('valorant', 'deaths',     'Morts',         'integer',    null, false, 20),
  ('valorant', 'assists',    'Assistances',   'integer',    null, true,  30),
  ('valorant', 'acs',        'ACS',           'decimal',    null, true,  40),
  ('valorant', 'hs_percent', '% headshots',   'percentage', '%',  true,  50),
  ('rocket-league', 'goals',   'Buts',        'integer',    null, true,  10),
  ('rocket-league', 'assists', 'Assistances', 'integer',    null, true,  20),
  ('rocket-league', 'saves',   'Arrêts',      'integer',    null, true,  30),
  ('rocket-league', 'shots',   'Tirs',        'integer',    null, true,  40),
  ('rocket-league', 'score',   'Score',       'integer',    null, true,  50),
  ('fortnite', 'kills',      'Éliminations',  'integer',    null, true,  10),
  ('fortnite', 'placement',  'Classement',    'integer',    null, false, 20),
  ('dota-2', 'kills',        'Kills',         'integer',    null, true,  10),
  ('dota-2', 'deaths',       'Morts',         'integer',    null, false, 20),
  ('dota-2', 'assists',      'Assistances',   'integer',    null, true,  30),
  ('dota-2', 'gpm',          'Or/min',        'integer',    null, true,  40),
  ('dota-2', 'xpm',          'XP/min',        'integer',    null, true,  50),
  ('dota-2', 'last_hits',    'Last hits',     'integer',    null, true,  60)
) as v(slug, key, label, value_type, unit, better, ord) on g.slug = v.slug
on conflict (game_id, scope, key) do nothing;

-- (4) Agrégats de performance d'un compte : calculés côté base (scalable), RLS de l'appelant appliquée.
create or replace function public.account_performance(_account uuid, _since timestamptz default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with m as (
    select played_at, result, duration_seconds, map_name, character_name, role_name, stats, data_source
    from public.player_match_history
    where account_id = _account and (_since is null or played_at >= _since)
  ),
  totals as (
    select count(*) as played,
           count(*) filter (where result = 'win')  as wins,
           count(*) filter (where result = 'loss') as losses,
           count(*) filter (where result = 'draw') as draws,
           coalesce(sum(duration_seconds), 0)      as seconds
    from m
  ),
  decided as (
    select result, row_number() over (order by played_at desc) as rn
    from m where result in ('win', 'loss')
  ),
  streak as (
    select (select result from decided where rn = 1) as kind,
           coalesce(
             (select min(rn) - 1 from decided where result <> (select result from decided where rn = 1)),
             (select count(*) from decided)
           ) as len
  ),
  averages as (
    select kv.key, round(avg(kv.value::numeric), 2) as avg, count(*) as n
    from m, lateral jsonb_each_text(m.stats) kv
    where kv.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    group by kv.key
  )
  select jsonb_build_object(
    'played', t.played, 'wins', t.wins, 'losses', t.losses, 'draws', t.draws, 'seconds', t.seconds,
    'streak', jsonb_build_object('kind', s.kind, 'length', s.len),
    'by_source', coalesce((select jsonb_object_agg(data_source, c) from (select data_source, count(*) as c from m group by data_source) x), '{}'::jsonb),
    'by_map', coalesce((select jsonb_agg(to_jsonb(x) order by x.played desc) from (
        select map_name as name, count(*) as played, count(*) filter (where result = 'win') as wins
        from m where map_name is not null group by map_name order by count(*) desc limit 20) x), '[]'::jsonb),
    'by_character', coalesce((select jsonb_agg(to_jsonb(x) order by x.played desc) from (
        select character_name as name, count(*) as played, count(*) filter (where result = 'win') as wins
        from m where character_name is not null group by character_name order by count(*) desc limit 20) x), '[]'::jsonb),
    'by_role', coalesce((select jsonb_agg(to_jsonb(x) order by x.played desc) from (
        select role_name as name, count(*) as played, count(*) filter (where result = 'win') as wins
        from m where role_name is not null group by role_name order by count(*) desc limit 20) x), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from (
        select (played_at at time zone 'UTC')::date as day, count(*) as played,
               count(*) filter (where result = 'win') as wins, count(*) filter (where result = 'loss') as losses
        from m group by 1) d), '[]'::jsonb),
    'stat_averages', coalesce((select jsonb_object_agg(key, jsonb_build_object('avg', avg, 'n', n)) from averages), '{}'::jsonb)
  )
  from totals t, streak s;
$$;

grant execute on function public.account_performance(uuid, timestamptz) to anon, authenticated;
