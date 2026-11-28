-- Migration 020 : actualités (appliquée sur le projet ESPORT-HUB sous le nom articles_news).
-- Lecture publique des articles publiés ; écriture par le staff ; suppression par les admins.

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 3 and 160),
  excerpt text check (char_length(excerpt) <= 400),
  body text not null check (char_length(body) between 1 and 50000),
  cover_url text check (cover_url ~ '^https?://'),
  category text not null default 'actualite' check (category in ('actualite','resultats','transferts','analyse','interview','communique')),
  game_id uuid references public.games(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  source_name text check (char_length(source_name) <= 120),
  source_url text check (source_url ~ '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index articles_published_idx on public.articles (status, published_at desc);
create index articles_game_idx on public.articles (game_id);

-- Date de publication automatique, mise à jour de updated_at, auteur = membre connecté.
create or replace function private.articles_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  if tg_op = 'INSERT' and new.author_id is null then new.author_id := (select auth.uid()); end if;
  return new;
end;
$$;
create trigger articles_before_write before insert or update on public.articles
  for each row execute function private.articles_before_write();

alter table public.articles enable row level security;
create policy articles_read on public.articles for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or (select private.is_staff()));
create policy articles_staff_insert on public.articles for insert to authenticated
  with check ((select private.is_staff()));
create policy articles_staff_update on public.articles for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy articles_admin_delete on public.articles for delete to authenticated
  using ((select private.is_admin()));
