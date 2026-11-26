-- Migration 017 : phase 7 — alerte de série déclenchée une seule fois.
-- Avant : à chaque défaite au-delà de la 3e (ou victoire au-delà de la 5e), la condition restait vraie
-- et une nouvelle notification était créée dès que la précédente était lue.
-- Après : on ne notifie que lorsque la série atteint exactement 3 défaites ou 5 victoires.

create or replace function private.on_history_streak()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recent text[]; n int;
begin
  if new.result not in ('win', 'loss') or new.played_at < now() - interval '1 day' then return null; end if;
  if not private.user_is_premium(new.profile_id) then return null; end if;

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
