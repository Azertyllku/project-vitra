-- Migration 011 : classement des équipes par jeu, calculé à partir des matchs terminés enregistrés.
-- security_invoker : la RLS des tables sources s'applique à l'appelant.
create or replace view public.team_standings
with (security_invoker = true) as
select
  m.game_id,
  mt.team_id,
  count(*)                                   as played,
  count(*) filter (where mt.is_winner)       as wins,
  count(*) filter (where mt.is_winner is false) as losses
from public.match_teams mt
join public.matches m on m.id = mt.match_id
where m.status = 'finished' and mt.team_id is not null
group by m.game_id, mt.team_id;

grant select on public.team_standings to anon, authenticated;
