-- Migration 002 : profils, ESPORT ID, rôles, préférences, favoris + RLS

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  esport_id     text not null unique check (esport_id ~ '^EH-[2-9A-HJ-NP-Z]{8}$'),
  username      extensions.citext not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name  text check (char_length(display_name) <= 60),
  avatar_url    text,
  banner_url    text,
  bio           text check (char_length(bio) <= 500),
  country_code  char(2),
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.profiles.esport_id is
  'Identifiant public unique et immuable (EH-XXXXXXXX). Non devinable, sans I/O/0/1.';

create index profiles_username_trgm on public.profiles using gin (username extensions.gin_trgm_ops);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Fonctions de rôle (SECURITY DEFINER : évitent la récursion RLS)
create or replace function private.has_role(_user uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = _user and role = _role)
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles
                 where user_id = (select auth.uid())
                   and role in ('editor', 'admin', 'super_admin'))
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles
                 where user_id = (select auth.uid())
                   and role in ('admin', 'super_admin'))
$$;

-- Génération de l'ESPORT ID
create or replace function private.generate_esport_id()
returns text language plpgsql set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := 'EH-';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where esport_id = candidate);
  end loop;
  return candidate;
end;
$$;

-- Création automatique du profil à l'inscription
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  wanted text := nullif(new.raw_user_meta_data ->> 'username', '');
  final_username text;
begin
  final_username := coalesce(
    case when wanted ~ '^[A-Za-z0-9_]{3,24}$'
          and not exists (select 1 from public.profiles where username = wanted::extensions.citext)
         then wanted end,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 10)
  );

  insert into public.profiles (id, esport_id, username, display_name)
  values (new.id, private.generate_esport_id(), final_username,
          coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), final_username));

  insert into public.user_roles (user_id, role) values (new.id, 'member');
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

-- Immuabilité de l'ESPORT ID
create or replace function private.protect_profile_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.esport_id is distinct from old.esport_id then
    raise exception 'id et esport_id sont immuables';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_identity before update on public.profiles
  for each row execute function private.protect_profile_identity();

create table public.user_preferences (
  user_id               uuid primary key references public.profiles (id) on delete cascade,
  locale                text not null default 'fr',
  theme                 text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  notification_settings jsonb not null default '{}'::jsonb,
  privacy_settings      jsonb not null default '{}'::jsonb,
  updated_at            timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function private.set_updated_at();

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create table public.user_favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('game', 'player', 'team', 'tournament', 'match')),
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);
create index user_favorites_entity on public.user_favorites (entity_type, entity_id);

alter table public.profiles         enable row level security;
alter table public.user_roles       enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_favorites   enable row level security;

create policy profiles_select on public.profiles for select to anon, authenticated
  using (is_public or id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy user_roles_write on public.user_roles for all to authenticated
  using ((select private.has_role((select auth.uid()), 'super_admin')))
  with check ((select private.has_role((select auth.uid()), 'super_admin')));

create policy user_preferences_own on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_favorites_own on public.user_favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
