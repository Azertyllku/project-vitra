-- Migration 014 : phase 6 — communauté (publications, commentaires, réactions, abonnements, messagerie,
-- notifications, chat des diffusions, signalements, modération, protection anti-spam).

-- ---------- Sanctions et blocages ----------
create table public.user_sanctions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('mute', 'ban')),
  reason     text,
  until      timestamptz,                       -- null = sans limite de durée
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index user_sanctions_user on public.user_sanctions (user_id);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function private.is_muted()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_sanctions s
                 where s.user_id = (select auth.uid()) and (s.until is null or s.until > now()))
$$;

create or replace function private.is_blocked(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks
                 where (blocker_id = _a and blocked_id = _b) or (blocker_id = _b and blocked_id = _a))
$$;

-- ---------- Communautés ----------
create table public.communities (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('game', 'team', 'custom')),
  game_id     uuid references public.games (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete cascade,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  check (kind <> 'game' or game_id is not null),
  check (kind <> 'team' or team_id is not null)
);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('member', 'moderator')),
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user on public.community_members (user_id);

-- ---------- Publications, commentaires, réactions ----------
create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  community_id  uuid references public.communities (id) on delete cascade,
  kind          text not null default 'text' check (kind in ('text', 'clip', 'performance')),
  body          text not null default '' check (char_length(body) <= 2000),
  clip_provider text check (clip_provider in ('youtube_video', 'twitch_clip')),
  clip_ref      text,
  account_id    uuid references public.player_game_accounts (id) on delete cascade,
  period        text check (period in ('7j', '30j', '90j', '6m', '1a', 'carriere')),
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  constraint posts_kind_fields check (
    (kind = 'text' and clip_ref is null and account_id is null and char_length(btrim(body)) >= 1) or
    (kind = 'clip' and clip_provider is not null and clip_ref is not null and account_id is null) or
    (kind = 'performance' and account_id is not null and period is not null and clip_ref is null)
  ),
  constraint posts_clip_format check (
    clip_ref is null or
    (clip_provider = 'youtube_video' and clip_ref ~ '^[A-Za-z0-9_-]{11}$') or
    (clip_provider = 'twitch_clip' and clip_ref ~ '^[A-Za-z0-9_-]{5,100}$')
  )
);
create index posts_feed on public.posts (created_at desc) where not is_hidden;
create index posts_community on public.posts (community_id, created_at desc);
create index posts_author on public.posts (author_id, created_at desc);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (post_id, id),
  foreign key (post_id, parent_id) references public.comments (post_id, id) on delete cascade
);
create index comments_post on public.comments (post_id, created_at);
create index comments_author on public.comments (author_id, created_at desc);

create table public.reactions (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   uuid not null,
  kind        text not null check (kind in ('like', 'gg', 'fire', 'laugh')),
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index reactions_target on public.reactions (target_type, target_id);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index follows_followed on public.follows (followed_id);

-- ---------- Messagerie privée ----------
create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index messages_recipient on public.messages (recipient_id, created_at desc);
create index messages_thread on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);

-- ---------- Notifications ----------
create table public.user_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index user_notifications_user on public.user_notifications (user_id, created_at desc);
create index user_notifications_unread on public.user_notifications (user_id) where read_at is null;

-- ---------- Chat des diffusions ----------
create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  stream_id  uuid not null references public.streams (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 300),
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_messages_stream on public.chat_messages (stream_id, created_at desc);

-- ---------- Signalements ----------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'message', 'chat_message', 'profile')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'harassment', 'hate', 'illegal', 'other')),
  details     text check (char_length(details) <= 500),
  status      text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_status on public.reports (status, created_at desc);

-- ---------- Protection anti-spam ----------
-- Limite de fréquence par auteur (le staff et le système sont exemptés).
create or replace function private.rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  col text := tg_argv[0];
  max_n int := tg_argv[1]::int;
  secs int := tg_argv[2]::int;
  uid uuid := (select auth.uid());
  n int;
begin
  if uid is null or private.is_staff() then return new; end if;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - make_interval(secs => $2)',
                 tg_table_schema, tg_table_name, col) into n using uid, secs;
  if n >= max_n then
    raise exception 'rate_limit_exceeded' using hint = 'Trop d''actions en peu de temps. Réessayez dans un instant.';
  end if;
  return new;
end;
$$;

-- Limite du nombre de liens dans un texte (anti-spam).
create or replace function private.limit_links()
returns trigger language plpgsql set search_path = '' as $$
declare max_n int := tg_argv[0]::int; txt text := coalesce(to_jsonb(new) ->> 'body', '');
begin
  if (select count(*) from regexp_matches(txt, 'https?://', 'gi')) > max_n then
    raise exception 'too_many_links' using hint = 'Trop de liens dans ce message.';
  end if;
  return new;
end;
$$;

create trigger posts_rate    before insert on public.posts         for each row execute function private.rate_limit('author_id', '5', '600');
create trigger comments_rate before insert on public.comments      for each row execute function private.rate_limit('author_id', '15', '600');
create trigger messages_rate before insert on public.messages      for each row execute function private.rate_limit('sender_id', '30', '600');
create trigger chat_rate     before insert on public.chat_messages for each row execute function private.rate_limit('user_id', '8', '30');
create trigger follows_rate  before insert on public.follows       for each row execute function private.rate_limit('follower_id', '60', '3600');
create trigger reports_rate  before insert on public.reports       for each row execute function private.rate_limit('reporter_id', '20', '3600');

create trigger posts_links    before insert or update on public.posts         for each row execute function private.limit_links('3');
create trigger comments_links before insert or update on public.comments      for each row execute function private.limit_links('3');
create trigger messages_links before insert on public.messages                 for each row execute function private.limit_links('3');
create trigger chat_links     before insert on public.chat_messages            for each row execute function private.limit_links('1');

-- Seul le staff peut masquer un contenu (modération) ; le destinataire ne peut que marquer lu ; notifications : lecture seule du contenu.
create or replace function private.protect_hidden()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_hidden is distinct from old.is_hidden and not private.is_staff() then
    raise exception 'Seul un modérateur peut masquer ou rétablir un contenu';
  end if;
  return new;
end;
$$;
create trigger posts_protect_hidden    before update on public.posts         for each row execute function private.protect_hidden();
create trigger comments_protect_hidden before update on public.comments      for each row execute function private.protect_hidden();
create trigger chat_protect_hidden     before update on public.chat_messages for each row execute function private.protect_hidden();

create or replace function private.protect_message_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.sender_id, new.recipient_id, new.body, new.created_at) is distinct from (old.sender_id, old.recipient_id, old.body, old.created_at) then
    raise exception 'Seule la mention « lu » peut être modifiée';
  end if;
  return new;
end;
$$;
create trigger messages_protect_update before update on public.messages for each row execute function private.protect_message_update();

create or replace function private.protect_notification_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.user_id, new.kind, new.title, new.body, new.link, new.created_at) is distinct from (old.user_id, old.kind, old.title, old.body, old.link, old.created_at) then
    raise exception 'Seule la mention « lu » peut être modifiée';
  end if;
  return new;
end;
$$;
create trigger notifications_protect_update before update on public.user_notifications for each row execute function private.protect_notification_update();

-- ---------- Notifications automatiques ----------
-- Respecte les préférences (user_preferences.notification_settings : {"kinds": {"comment": false}, "muted_games": ["<id>"]})
-- et évite les doublons non lus (même type, même lien).
create or replace function private.notify(_user uuid, _kind text, _title text, _body text, _link text, _game uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s jsonb;
begin
  select notification_settings into s from public.user_preferences where user_id = _user;
  if s is not null then
    if (s -> 'kinds' ->> _kind) = 'false' then return; end if;
    if _game is not null and coalesce((s -> 'muted_games') ? _game::text, false) then return; end if;
  end if;
  if exists (select 1 from public.user_notifications where user_id = _user and kind = _kind and link is not distinct from _link and read_at is null) then
    return;
  end if;
  insert into public.user_notifications (user_id, kind, title, body, link) values (_user, _kind, _title, _body, _link);
end;
$$;

create or replace function private.on_comment_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare post_author uuid; parent_author uuid; who text;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  select username::text into who from public.profiles where id = new.author_id;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id then
      perform private.notify(parent_author, 'reply', who || ' a répondu à votre commentaire', left(new.body, 80), '/communaute/posts/' || new.post_id);
    end if;
  end if;
  if post_author is not null and post_author <> new.author_id and post_author is distinct from parent_author then
    perform private.notify(post_author, 'comment', who || ' a commenté votre publication', left(new.body, 80), '/communaute/posts/' || new.post_id);
  end if;
  return null;
end;
$$;
create trigger comments_notify after insert on public.comments for each row execute function private.on_comment_created();

create or replace function private.on_follow_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare who text;
begin
  select username::text into who from public.profiles where id = new.follower_id;
  perform private.notify(new.followed_id, 'follow', who || ' vous suit désormais', null, '/membres/' || who);
  return null;
end;
$$;
create trigger follows_notify after insert on public.follows for each row execute function private.on_follow_created();

create or replace function private.on_message_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare who text;
begin
  select username::text into who from public.profiles where id = new.sender_id;
  perform private.notify(new.recipient_id, 'message', 'Nouveau message de ' || coalesce(who, 'un membre'), null, '/messages/' || new.sender_id);
  return null;
end;
$$;
create trigger messages_notify after insert on public.messages for each row execute function private.on_message_created();

create or replace function private.on_reaction_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare author uuid; who text; post uuid;
begin
  if new.target_type = 'post' then
    select author_id into author from public.posts where id = new.target_id;
    post := new.target_id;
  else
    select author_id, post_id into author, post from public.comments where id = new.target_id;
  end if;
  if author is not null and author <> new.user_id then
    select username::text into who from public.profiles where id = new.user_id;
    perform private.notify(author, 'reaction', who || ' a réagi à votre ' || case when new.target_type = 'post' then 'publication' else 'commentaire' end, null, '/communaute/posts/' || post);
  end if;
  return null;
end;
$$;
create trigger reactions_notify after insert on public.reactions for each row execute function private.on_reaction_created();

-- Un match passe « en direct » : notifie ceux qui suivent le match, ses équipes, son tournoi ou son jeu.
create or replace function private.on_match_live()
returns trigger language plpgsql security definer set search_path = '' as $$
declare u uuid; names text;
begin
  select string_agg(t.name, ' vs ' order by mt.slot) into names
  from public.match_teams mt join public.teams t on t.id = mt.team_id where mt.match_id = new.id;
  for u in
    select distinct f.user_id from public.user_favorites f
    where (f.entity_type = 'match' and f.entity_id = new.id)
       or (f.entity_type = 'tournament' and f.entity_id = new.tournament_id)
       or (f.entity_type = 'game' and f.entity_id = new.game_id)
       or (f.entity_type = 'team' and f.entity_id in (select team_id from public.match_teams where match_id = new.id and team_id is not null))
  loop
    perform private.notify(u, 'match_live', 'Match en direct', coalesce(names, 'Un match que vous suivez commence'), '/matchs/' || new.id, new.game_id);
  end loop;
  return null;
end;
$$;
create trigger matches_live_notify after update of status on public.matches
  for each row when (old.status is distinct from new.status and new.status = 'live') execute function private.on_match_live();

-- Nouvelle rediffusion autorisée : notifie ceux qui suivent son match, son tournoi ou son jeu.
create or replace function private.on_vod_authorized()
returns trigger language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  for u in
    select distinct f.user_id from public.user_favorites f
    where (f.entity_type = 'match' and f.entity_id = new.match_id)
       or (f.entity_type = 'tournament' and f.entity_id = new.tournament_id)
       or (f.entity_type = 'game' and f.entity_id = new.game_id)
  loop
    perform private.notify(u, 'new_vod', 'Nouvelle rediffusion disponible', new.title, '/rediffusions/' || new.id, new.game_id);
  end loop;
  return null;
end;
$$;
create trigger vods_authorized_notify_insert after insert on public.vods
  for each row when (new.rights_status = 'authorized') execute function private.on_vod_authorized();
create trigger vods_authorized_notify_update after update of rights_status on public.vods
  for each row when (old.rights_status is distinct from new.rights_status and new.rights_status = 'authorized') execute function private.on_vod_authorized();

-- ---------- Fonctions de lecture ----------
create or replace function public.reaction_counts(_type text, _ids uuid[])
returns table (target_id uuid, kind text, n bigint)
language sql stable set search_path = '' as $$
  select r.target_id, r.kind, count(*) from public.reactions r
  where r.target_type = _type and r.target_id = any(_ids) group by r.target_id, r.kind
$$;

create or replace function public.my_conversations()
returns table (partner_id uuid, partner_username text, last_body text, last_at timestamptz, last_from_me boolean, unread bigint)
language sql stable set search_path = '' as $$
  with m as (
    select *, case when sender_id = (select auth.uid()) then recipient_id else sender_id end as partner
    from public.messages
    where sender_id = (select auth.uid()) or recipient_id = (select auth.uid())
  ),
  last as (select distinct on (partner) partner, body, created_at, sender_id from m order by partner, created_at desc)
  select l.partner, coalesce(p.username::text, 'Membre'), l.body, l.created_at,
         l.sender_id = (select auth.uid()),
         (select count(*) from m where m.partner = l.partner and m.recipient_id = (select auth.uid()) and m.read_at is null)
  from last l left join public.profiles p on p.id = l.partner
  order by l.created_at desc limit 100
$$;

-- ---------- RLS ----------
alter table public.user_sanctions     enable row level security;
alter table public.user_blocks        enable row level security;
alter table public.communities        enable row level security;
alter table public.community_members  enable row level security;
alter table public.posts              enable row level security;
alter table public.comments           enable row level security;
alter table public.reactions          enable row level security;
alter table public.follows            enable row level security;
alter table public.messages           enable row level security;
alter table public.user_notifications enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.reports            enable row level security;

create policy sanctions_select on public.user_sanctions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy sanctions_staff_write on public.user_sanctions for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy blocks_own on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create policy communities_read on public.communities for select to anon, authenticated using (true);
create policy communities_staff_write on public.communities for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy members_read on public.community_members for select to anon, authenticated using (true);
create policy members_join on public.community_members for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'member' and not (select private.is_muted()));
create policy members_leave on public.community_members for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy members_staff_update on public.community_members for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy posts_read on public.posts for select to anon, authenticated
  using (not is_hidden or author_id = (select auth.uid()) or (select private.is_staff()));
create policy posts_insert on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid()) and not (select private.is_muted())
    and (community_id is null or exists (select 1 from public.community_members m where m.community_id = posts.community_id and m.user_id = (select auth.uid())))
    and (account_id is null or (select private.owns_account(account_id)))
  );
create policy posts_update on public.posts for update to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff()))
  with check (author_id = (select auth.uid()) or (select private.is_staff()));
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff()));

create policy comments_read on public.comments for select to anon, authenticated
  using (not is_hidden or author_id = (select auth.uid()) or (select private.is_staff()));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid()) and not (select private.is_muted())
    and exists (select 1 from public.posts p where p.id = post_id)
  );
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff()))
  with check (author_id = (select auth.uid()) or (select private.is_staff()));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff()));

create policy reactions_read on public.reactions for select to anon, authenticated using (true);
create policy reactions_write_own on public.reactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and not (select private.is_muted()));

create policy follows_read on public.follows for select to anon, authenticated using (true);
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and not (select private.is_blocked(follower_id, followed_id)));
create policy follows_delete on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

create policy messages_read on public.messages for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and not (select private.is_muted()) and not (select private.is_blocked(sender_id, recipient_id)));
create policy messages_mark_read on public.messages for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy messages_delete_sent on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()));

create policy notifications_read on public.user_notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.user_notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.user_notifications for delete to authenticated using (user_id = (select auth.uid()));

create policy chat_read on public.chat_messages for select to anon, authenticated
  using (not is_hidden or user_id = (select auth.uid()) or (select private.is_staff()));
create policy chat_insert on public.chat_messages for insert to authenticated
  with check (
    user_id = (select auth.uid()) and not (select private.is_muted())
    and exists (select 1 from public.streams s where s.id = stream_id and s.status <> 'ended')
  );
create policy chat_staff_update on public.chat_messages for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy chat_delete on public.chat_messages for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_staff()));
create policy reports_staff_update on public.reports for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- ---------- Communautés initiales : une par jeu (structure, aucun contenu) ----------
insert into public.communities (kind, game_id, slug, name, description)
select 'game', g.id, g.slug, g.name, 'Discussions de la communauté ' || g.name
from public.games g
on conflict (slug) do nothing;

-- ---------- Temps réel (RLS appliquée aux abonnés) ----------
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.user_notifications;
alter publication supabase_realtime add table public.messages;
