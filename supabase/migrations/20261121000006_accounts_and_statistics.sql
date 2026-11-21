-- Migration 006 : comptes de jeux, historique de parties (partitionné), statistiques, rangs, succès + RLS

create table public.player_game_accounts (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles (id) on delete cascade,
  player_id           uuid references public.players (id) on delete set null,
  game_id             uuid not null references public.games (id),
  provider            text not null,
  external_id         text not null,
  display_name        text,
  region              text,
  verification_status public.verification_status not null default 'unverified',
  data_source         public.data_source not null default 'manual',
  is_public           boolean not null default false,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (game_id, provider, external_id)
);
create index player_game_accounts_profile on public.player_game_accounts (profile_id);
create trigger player_game_accounts_updated_at before update on public.player_game_accounts
  for each row execute function private.set_updated_at();
-- Les jetons OAuth ne sont JAMAIS stockés ici (Vault / Edge Functions uniquement).

create or replace function private.protect_account_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.is_staff() then
    if new.verification_status is distinct from old.verification_status
       or new.data_source is distinct from old.data_source
       or new.last_synced_at is distinct from old.last_synced_at
       or new.profile_id is distinct from old.profile_id then
      raise exception 'Champs réservés au système de synchronisation';
    end if;
  end if;
  return new;
end;
$$;
create trigger player_game_accounts_protect before update on public.player_game_accounts
  for each row execute function private.protect_account_fields();

create or replace function private.owns_account(_account uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.player_game_accounts
                 where id = _account and profile_id = (select auth.uid()))
$$;

create or replace function private.can_view_account(_account uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.player_game_accounts a
    where a.id = _account
      and (a.profile_id = (select auth.uid())
           or (a.is_public and a.verification_status = 'verified'))
  ) or private.is_staff()
$$;

-- Table la plus volumineuse -> partitions annuelles.
create table public.player_match_history (
  id                uuid not null default gen_random_uuid(),
  profile_id        uuid not null references public.profiles (id) on delete cascade,
  player_id         uuid references public.players (id) on delete cascade,
  account_id        uuid not null references public.player_game_accounts (id) on delete cascade,
  game_id           uuid not null references public.games (id),
  mode_id           uuid references public.game_modes (id),
  external_match_id text not null,
  played_at         timestamptz not null,
  duration_seconds  int check (duration_seconds >= 0),
  result            text not null default 'unknown' check (result in ('win', 'loss', 'draw', 'unknown')),
  map_name          text,
  character_name    text,
  role_name         text,
  stats             jsonb not null default '{}'::jsonb,
  data_source       public.data_source not null,
  imported_at       timestamptz not null default now(),
  primary key (id, played_at),
  unique (account_id, external_match_id, played_at)
) partition by range (played_at);

create index player_match_history_profile on public.player_match_history (profile_id, game_id, played_at desc);
create index player_match_history_account on public.player_match_history (account_id, played_at desc);

do $$
declare y int;
begin
  for y in 2024..2030 loop
    execute format(
      'create table public.player_match_history_%s partition of public.player_match_history for values from (%L) to (%L)',
      y, y || '-01-01', (y + 1) || '-01-01');
  end loop;
end $$;
create table public.player_match_history_default partition of public.player_match_history default;
-- À automatiser plus tard : création des partitions (pg_cron / pg_partman).

create table public.player_statistics (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  game_id     uuid not null references public.games (id) on delete cascade,
  account_id  uuid references public.player_game_accounts (id) on delete cascade,
  period      text not null check (period in ('7d', '30d', '90d', '6m', '1y', 'career', 'season')),
  season_key  text not null default '',
  metrics     jsonb not null default '{}'::jsonb,
  data_source public.data_source not null,
  computed_at timestamptz not null default now()
);
create unique index player_statistics_unique on public.player_statistics
  (player_id, game_id, period, season_key, coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.player_rank_history (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  account_id  uuid not null references public.player_game_accounts (id) on delete cascade,
  game_id     uuid not null references public.games (id),
  recorded_at timestamptz not null default now(),
  rank_label  text,
  rating      numeric,
  season_key  text not null default '',
  data_source public.data_source not null
);
create index player_rank_history_account on public.player_rank_history (account_id, recorded_at desc);

create table public.player_achievements (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  game_id     uuid references public.games (id) on delete set null,
  code        text not null,
  title       text not null,
  description text,
  achieved_at timestamptz,
  data_source public.data_source not null default 'manual',
  unique (player_id, code)
);

alter table public.player_game_accounts enable row level security;
alter table public.player_match_history enable row level security;
alter table public.player_statistics    enable row level security;
alter table public.player_rank_history  enable row level security;
alter table public.player_achievements  enable row level security;

create policy accounts_select on public.player_game_accounts for select to anon, authenticated
  using (profile_id = (select auth.uid())
         or (is_public and verification_status = 'verified')
         or (select private.is_staff()));
create policy accounts_insert_own on public.player_game_accounts for insert to authenticated
  with check (profile_id = (select auth.uid())
              and verification_status = 'unverified'
              and data_source = 'manual');
create policy accounts_update_own on public.player_game_accounts for update to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_staff()))
  with check (profile_id = (select auth.uid()) or (select private.is_staff()));
create policy accounts_delete_own on public.player_game_accounts for delete to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_admin()));

create policy history_select on public.player_match_history for select to anon, authenticated
  using (profile_id = (select auth.uid())
         or (select private.is_staff())
         or (select private.can_view_account(account_id)));
create policy history_insert_manual on public.player_match_history for insert to authenticated
  with check (profile_id = (select auth.uid())
              and data_source = 'manual'
              and (select private.owns_account(account_id)));
create policy history_update_manual on public.player_match_history for update to authenticated
  using (profile_id = (select auth.uid()) and data_source = 'manual')
  with check (profile_id = (select auth.uid()) and data_source = 'manual');
create policy history_delete_own on public.player_match_history for delete to authenticated
  using (profile_id = (select auth.uid()) and data_source = 'manual');

create policy statistics_select on public.player_statistics for select to anon, authenticated
  using ((select private.can_view_player(player_id)));
create policy statistics_staff_write on public.player_statistics for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy achievements_select on public.player_achievements for select to anon, authenticated
  using ((select private.can_view_player(player_id)));
create policy achievements_staff_write on public.player_achievements for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy rank_history_select on public.player_rank_history for select to anon, authenticated
  using (profile_id = (select auth.uid())
         or (select private.is_staff())
         or (select private.can_view_account(account_id)));
create policy rank_history_staff_write on public.player_rank_history for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
