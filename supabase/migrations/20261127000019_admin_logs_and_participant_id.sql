-- Migration 019 : phase 8 — journal des actions d'administration et identifiant des participants de tournoi.
-- (Appliquée sur le projet ESPORT-HUB sous le nom admin_logs_and_participant_id.)

-- Journal : lecture réservée aux admins ; écriture par le staff sous sa propre identité ; jamais modifiable ni supprimable.
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('create','update','delete','grant_role','revoke_role','sanction','lift_sanction','setting')),
  target_type text not null,
  target_id text,
  summary text,
  created_at timestamptz not null default now()
);
create index if not exists admin_logs_created_idx on public.admin_logs (created_at desc);
alter table public.admin_logs enable row level security;
create policy admin_logs_insert on public.admin_logs for insert to authenticated
  with check (actor_id = (select auth.uid()) and (select private.is_staff()));
create policy admin_logs_select on public.admin_logs for select to authenticated
  using ((select private.is_admin()));

-- Les participants de tournoi reçoivent un identifiant simple pour être modifiables depuis l'administration
-- (la clé primaire (tournament_id, team_id) reste inchangée).
alter table public.tournament_participants add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists tournament_participants_id_key on public.tournament_participants (id);
