-- Migration 016 : phase 7 — paramètres de plateforme, abonnements Premium (Stripe), rapports IA,
-- tableaux de bord personnalisés, alertes avancées.

-- ---------- Paramètres de plateforme ----------
create table public.platform_settings (
  key        text primary key check (key ~ '^[a-z0-9_]+$'),
  value      jsonb not null,
  is_public  boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
create policy platform_settings_read on public.platform_settings for select to anon, authenticated
  using (is_public or (select private.is_staff()));
create policy platform_settings_admin_write on public.platform_settings for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
-- Le paiement n'est jamais obligatoire et reste désactivé tant que Stripe n'est pas configuré.
insert into public.platform_settings (key, value, is_public) values ('billing_enabled', 'false'::jsonb, true)
on conflict (key) do nothing;

-- ---------- Droit Premium ----------
create or replace function private.user_is_premium(_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = _user and role in ('premium', 'admin', 'super_admin'))
$$;
create or replace function private.is_premium()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.user_is_premium((select auth.uid()))
$$;

-- ---------- Offres et abonnements ----------
create table public.subscription_plans (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[a-z0-9_]+$'),
  name            text not null,
  description     text,
  billing_interval text not null check (billing_interval in ('month', 'year')),
  price_cents     int check (price_cents >= 0),            -- null = tarif à définir
  currency        char(3) not null default 'EUR',
  stripe_price_id text,                                    -- renseigné une fois le prix créé dans Stripe
  features        jsonb not null default '[]'::jsonb,
  is_active       boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
alter table public.subscription_plans enable row level security;
create policy plans_read on public.subscription_plans for select to anon, authenticated
  using (is_active or (select private.is_staff()));
create policy plans_admin_write on public.subscription_plans for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

insert into public.subscription_plans (code, name, description, billing_interval, features, sort_order) values
  ('premium_monthly', 'Premium mensuel', 'Toutes les fonctionnalités avancées, sans engagement.', 'month',
   '["Statistiques avancées (carte, personnage, rôle, moyennes)","Analyses historiques approfondies (6 mois, 1 an, carrière)","Comparaisons avancées","Tableau de bord personnalisable","Alertes avancées (séries)","Rapports et résumés IA","Graphiques supplémentaires"]'::jsonb, 10),
  ('premium_yearly', 'Premium annuel', 'Les mêmes avantages, facturés à l''année.', 'year',
   '["Statistiques avancées (carte, personnage, rôle, moyennes)","Analyses historiques approfondies (6 mois, 1 an, carrière)","Comparaisons avancées","Tableau de bord personnalisable","Alertes avancées (séries)","Rapports et résumés IA","Graphiques supplémentaires"]'::jsonb, 20)
on conflict (code) do nothing;

create table public.stripe_customers (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;
create policy stripe_customers_own on public.stripe_customers for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  plan_id                uuid references public.subscription_plans (id) on delete set null,
  stripe_subscription_id text not null unique,
  stripe_customer_id     text not null,
  status                 text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index subscriptions_user on public.subscriptions (user_id);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();
alter table public.subscriptions enable row level security;
create policy subscriptions_read on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles (id) on delete set null,
  subscription_id    uuid references public.subscriptions (id) on delete set null,
  stripe_invoice_id  text not null unique,
  amount_cents       int not null check (amount_cents >= 0),
  currency           char(3) not null,
  status             text not null check (status in ('paid', 'failed', 'open', 'void', 'uncollectible', 'draft')),
  hosted_invoice_url text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index payments_user on public.payments (user_id, created_at desc);
alter table public.payments enable row level security;
create policy payments_read on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

-- Idempotence des webhooks Stripe : aucune politique = inaccessible hors service_role.
create table public.stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- ---------- Rapports IA ----------
create table public.ai_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('performance', 'match', 'tournament')),
  account_id    uuid references public.player_game_accounts (id) on delete cascade,
  match_id      uuid references public.matches (id) on delete cascade,
  tournament_id uuid references public.tournaments (id) on delete cascade,
  period        text check (period in ('7j', '30j', '90j', '6m', '1a', 'carriere')),
  content       text not null,
  provider      text not null check (provider in ('rules', 'anthropic')),
  model         text,
  input_summary jsonb not null default '{}'::jsonb,   -- données réellement fournies à l'analyse (transparence)
  created_at    timestamptz not null default now(),
  check ((kind = 'performance' and account_id is not null) or (kind = 'match' and match_id is not null) or (kind = 'tournament' and tournament_id is not null))
);
create index ai_reports_user on public.ai_reports (user_id, created_at desc);
alter table public.ai_reports enable row level security;
create policy ai_reports_own on public.ai_reports for select to authenticated using (user_id = (select auth.uid()));
create policy ai_reports_delete_own on public.ai_reports for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- Tableau de bord personnalisable (Premium) ----------
create table public.user_dashboards (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  config     jsonb not null default '{}'::jsonb,   -- {"hidden": ["by_map", ...], "default_period": "30j"}
  updated_at timestamptz not null default now()
);
alter table public.user_dashboards enable row level security;
create policy dashboards_read on public.user_dashboards for select to authenticated using (user_id = (select auth.uid()));
create policy dashboards_write on public.user_dashboards for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_premium()))
  with check (user_id = (select auth.uid()) and (select private.is_premium()));

-- ---------- Alertes avancées (Premium) : séries de défaites / victoires ----------
create or replace function private.on_history_streak()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recent text[];
begin
  if new.result not in ('win', 'loss') or new.played_at < now() - interval '1 day' then return null; end if;
  if not private.user_is_premium(new.profile_id) then return null; end if;

  select array_agg(result order by played_at desc) into recent
  from (select result, played_at from public.player_match_history
        where account_id = new.account_id and result in ('win', 'loss')
        order by played_at desc limit 5) x;

  if new.result = 'loss' and coalesce(array_length(recent, 1), 0) >= 3 and recent[1:3] = array['loss', 'loss', 'loss'] then
    perform private.notify(new.profile_id, 'streak', 'Série de 3 défaites', 'Vos trois dernières parties décidées sur ce compte sont des défaites.',
                           '/profil/performances?compte=' || new.account_id, new.game_id);
  elsif new.result = 'win' and coalesce(array_length(recent, 1), 0) >= 5 and recent = array['win', 'win', 'win', 'win', 'win'] then
    perform private.notify(new.profile_id, 'streak', 'Série de 5 victoires', 'Vos cinq dernières parties décidées sur ce compte sont des victoires.',
                           '/profil/performances?compte=' || new.account_id, new.game_id);
  end if;
  return null;
end;
$$;
create trigger player_match_history_streak after insert on public.player_match_history
  for each row execute function private.on_history_streak();
