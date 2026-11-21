-- Migration 012 : phase 4 — diffusion en direct, sources autorisées, rediffusions, historique, favoris, playlists.
-- Un flux n'est visible publiquement que si ses droits sont documentés et validés (rights_status = 'authorized').

create type public.rights_status as enum ('pending', 'authorized', 'revoked');

create table public.video_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name       text not null,
  sort_order int not null default 0
);

create table public.streams (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games (id),
  match_id      uuid references public.matches (id) on delete set null,
  tournament_id uuid references public.tournaments (id) on delete set null,
  title         text not null,
  status        text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  starts_at     timestamptz,
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index streams_status on public.streams (status, starts_at);
create index streams_match on public.streams (match_id);
create index streams_game on public.streams (game_id, status);
create trigger streams_updated_at before update on public.streams
  for each row execute function private.set_updated_at();

-- Chaînes de diffusion d'un événement (une par langue / fournisseur).
create table public.stream_sources (
  id            uuid primary key default gen_random_uuid(),
  stream_id     uuid not null references public.streams (id) on delete cascade,
  provider      text not null check (provider in ('twitch_channel', 'twitch_video', 'youtube_video', 'hls')),
  embed_ref     text not null,
  language      text not null default 'fr' check (language ~ '^[a-z]{2}$'),
  label         text,
  is_official   boolean not null default false,
  rights_status public.rights_status not null default 'pending',
  rights_holder text,
  rights_note   text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint stream_sources_ref_format check (
    (provider = 'twitch_channel' and embed_ref ~ '^[A-Za-z0-9_]{3,25}$') or
    (provider = 'twitch_video'   and embed_ref ~ '^[0-9]{5,15}$') or
    (provider = 'youtube_video'  and embed_ref ~ '^[A-Za-z0-9_-]{11}$') or
    (provider = 'hls'            and embed_ref ~ '^https://[^\s"''<>]+$')
  ),
  constraint stream_sources_rights_documented check (
    rights_status <> 'authorized' or (rights_holder is not null and char_length(btrim(rights_holder)) > 0)
  )
);
create index stream_sources_stream on public.stream_sources (stream_id, sort_order);
create trigger stream_sources_updated_at before update on public.stream_sources
  for each row execute function private.set_updated_at();

create table public.vods (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references public.games (id),
  match_id         uuid references public.matches (id) on delete set null,
  tournament_id    uuid references public.tournaments (id) on delete set null,
  category_id      uuid references public.video_categories (id) on delete set null,
  title            text not null,
  description      text,
  kind             text not null default 'full' check (kind in ('full', 'highlight', 'best_play', 'summary')),
  provider         text not null check (provider in ('twitch_video', 'youtube_video', 'hls')),
  embed_ref        text not null,
  language         text not null default 'fr' check (language ~ '^[a-z]{2}$'),
  duration_seconds int check (duration_seconds > 0),
  thumbnail_url    text,
  published_at     timestamptz not null default now(),
  rights_status    public.rights_status not null default 'pending',
  rights_holder    text,
  rights_note      text,
  viewer_count     bigint not null default 0,   -- nombre de membres connectés ayant ouvert la vidéo
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint vods_ref_format check (
    (provider = 'twitch_video'  and embed_ref ~ '^[0-9]{5,15}$') or
    (provider = 'youtube_video' and embed_ref ~ '^[A-Za-z0-9_-]{11}$') or
    (provider = 'hls'           and embed_ref ~ '^https://[^\s"''<>]+$')
  ),
  constraint vods_rights_documented check (
    rights_status <> 'authorized' or (rights_holder is not null and char_length(btrim(rights_holder)) > 0)
  )
);
create index vods_game_published on public.vods (game_id, published_at desc);
create index vods_match on public.vods (match_id);
create index vods_popular on public.vods (viewer_count desc) where rights_status = 'authorized';
create index vods_title_trgm on public.vods using gin (title extensions.gin_trgm_ops);
create trigger vods_updated_at before update on public.vods
  for each row execute function private.set_updated_at();

create table public.vod_chapters (
  id            uuid primary key default gen_random_uuid(),
  vod_id        uuid not null references public.vods (id) on delete cascade,
  title         text not null,
  start_seconds int not null check (start_seconds >= 0),
  sort_order    int not null default 0
);
create index vod_chapters_vod on public.vod_chapters (vod_id, start_seconds);

create table public.video_views (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  vod_id           uuid not null references public.vods (id) on delete cascade,
  progress_seconds int not null default 0 check (progress_seconds >= 0),
  completed        boolean not null default false,
  first_watched_at timestamptz not null default now(),
  last_watched_at  timestamptz not null default now(),
  primary key (user_id, vod_id)
);
create index video_views_user_recent on public.video_views (user_id, last_watched_at desc);

create table public.video_favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  vod_id     uuid not null references public.vods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vod_id)
);

create table public.playlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  is_public  boolean not null default false,
  created_at timestamptz not null default now()
);
create index playlists_user on public.playlists (user_id);

create table public.playlist_items (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  vod_id      uuid not null references public.vods (id) on delete cascade,
  position    int not null default 0,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, vod_id)
);

-- Compteur de spectateurs (membres) maintenu par triggers.
create or replace function private.bump_vod_viewers()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.vods set viewer_count = viewer_count + 1 where id = new.vod_id;
  else
    update public.vods set viewer_count = greatest(viewer_count - 1, 0) where id = old.vod_id;
  end if;
  return null;
end;
$$;
create trigger video_views_count after insert or delete on public.video_views
  for each row execute function private.bump_vod_viewers();

-- RLS ---------------------------------------------------------------------------
alter table public.video_categories enable row level security;
alter table public.streams          enable row level security;
alter table public.stream_sources   enable row level security;
alter table public.vods             enable row level security;
alter table public.vod_chapters     enable row level security;
alter table public.video_views      enable row level security;
alter table public.video_favorites  enable row level security;
alter table public.playlists        enable row level security;
alter table public.playlist_items   enable row level security;

-- Catégories et événements de diffusion : lecture publique, écriture staff.
do $$
declare t text;
begin
  foreach t in array array['video_categories', 'streams'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_staff()))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_admin_delete', t);
  end loop;
end $$;

-- Sources et rediffusions : visibles par le public UNIQUEMENT si les droits sont validés.
do $$
declare t text;
begin
  foreach t in array array['stream_sources', 'vods'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (rights_status = ''authorized'' or (select private.is_staff()))', t || '_authorized_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_staff()))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_admin_delete', t);
  end loop;
end $$;

-- Chapitres : visibles si la rediffusion l'est (la RLS de vods s'applique à la sous-requête).
create policy vod_chapters_read on public.vod_chapters for select to anon, authenticated
  using (exists (select 1 from public.vods v where v.id = vod_id));
create policy vod_chapters_staff_write on public.vod_chapters for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- Historique, favoris : strictement privés.
create policy video_views_own on public.video_views for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy video_favorites_own on public.video_favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Playlists : privées par défaut, lisibles par tous si is_public.
create policy playlists_select on public.playlists for select to anon, authenticated
  using (is_public or user_id = (select auth.uid()));
create policy playlists_write_own on public.playlists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy playlist_items_select on public.playlist_items for select to anon, authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id));
create policy playlist_items_write_own on public.playlist_items for all to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));

-- Realtime : statut des diffusions et sources.
alter publication supabase_realtime add table public.streams;
alter publication supabase_realtime add table public.stream_sources;
