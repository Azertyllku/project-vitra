-- Migration 018 : le projet reste gratuit — les fonctionnalités avancées sont ouvertes à tout membre connecté.
-- Additif : aucune donnée supprimée. Les tables d'abonnement et de paiement sont conservées mais inutilisées ;
-- les offres sont désactivées et le réglage billing_enabled reste à false.

-- Tableau de bord personnalisable : tout membre peut enregistrer le sien.
drop policy if exists dashboards_write on public.user_dashboards;
create policy dashboards_write on public.user_dashboards for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Offres Premium : désactivées (invisibles pour le public).
update public.subscription_plans set is_active = false;
update public.platform_settings set value = 'false'::jsonb where key = 'billing_enabled';

-- Alertes de série : pour tous les membres, une seule fois par série (3 défaites ou 5 victoires).
create or replace function private.on_history_streak()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recent text[]; n int;
begin
  if new.result not in ('win', 'loss') or new.played_at < now() - interval '1 day' then return null; end if;

  select array_agg(result order by played_at desc) into recent
  from (select result, played_at from public.player_match_history
        where account_id = new.account_id and result in ('win', 'loss')
        order by played_at desc limit 6) x;
  n := coalesce(array_length(recent, 1), 0);

  if new.result = 'loss' and n >= 3 and recent[1:3] = array['loss', 'loss', 'loss'] and (n < 4 or recent[4] <> 'loss') then
    perform private.notify(new.profile_id, 'streak', 'Série de 3 défaites', 'Vos trois dernières parties décidées sur ce compte sont des défaites.',
                           '/profil/performances?compte=' || new.account_id, new.game_id);
  elsif new.result = 'win' and n >= 5 and recent[1:5] = array['win', 'win', 'win', 'win', 'win'] and (n < 6 or recent[6] <> 'win') then
    perform private.notify(new.profile_id, 'streak', 'Série de 5 victoires', 'Vos cinq dernières parties décidées sur ce compte sont des victoires.',
                           '/profil/performances?compte=' || new.account_id, new.game_id);
  end if;
  return null;
end;
$$;
