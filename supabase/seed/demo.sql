-- DONNÉES DE DÉMONSTRATION (data_source = 'demo', noms fictifs suffixés « (démo) »).
-- NON appliqué automatiquement. À exécuter uniquement en environnement de test :
-- cela permet de voir les pages Matchs / Tournois / Équipes / Joueurs / Classements remplies.
-- Pour retirer : delete from public.matches where data_source = 'demo'; delete from public.tournaments
-- where data_source = 'demo'; delete from public.teams where name like '%(démo)'; delete from public.players where nickname like '%(démo)';

do $$
declare
  g uuid; t1 uuid; t2 uuid; t3 uuid; p1 uuid; p2 uuid; tour uuid; m uuid;
begin
  select id into g from public.games where slug = 'counter-strike-2';

  insert into public.teams (slug, name, tag, description) values ('demo-alpha', 'Demo Alpha (démo)', 'DMA', 'Équipe fictive de démonstration') returning id into t1;
  insert into public.teams (slug, name, tag, description) values ('demo-bravo', 'Demo Bravo (démo)', 'DMB', 'Équipe fictive de démonstration') returning id into t2;
  insert into public.teams (slug, name, tag, description) values ('demo-charlie', 'Demo Charlie (démo)', 'DMC', 'Équipe fictive de démonstration') returning id into t3;

  insert into public.players (slug, nickname, bio, is_professional) values ('demo-joueur-un', 'JoueurUn (démo)', 'Joueur fictif de démonstration', true) returning id into p1;
  insert into public.players (slug, nickname, bio, is_professional) values ('demo-joueur-deux', 'JoueurDeux (démo)', 'Joueur fictif de démonstration', true) returning id into p2;
  insert into public.team_members (team_id, player_id, game_id, role) values (t1, p1, g, 'player'), (t2, p2, g, 'player');

  insert into public.tournaments (game_id, slug, name, organizer, format, status, starts_at, ends_at, prize_pool, currency, data_source)
  values (g, 'demo-cup', 'Demo Cup (démonstration)', 'ESPORT HUB (démo)', 'single_elimination', 'ongoing', now() - interval '3 days', now() + interval '5 days', 10000, 'EUR', 'demo')
  returning id into tour;
  insert into public.tournament_participants (tournament_id, team_id, seed) values (tour, t1, 1), (tour, t2, 2), (tour, t3, 3);

  -- Match terminé
  insert into public.matches (game_id, tournament_id, status, scheduled_at, started_at, ended_at, best_of, round_label, data_source)
  values (g, tour, 'finished', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 3, 'Demi-finale', 'demo') returning id into m;
  insert into public.match_teams (match_id, slot, team_id, score, is_winner) values (m, 1, t1, 2, true), (m, 2, t2, 1, false);

  -- Match en direct
  insert into public.matches (game_id, tournament_id, status, scheduled_at, started_at, best_of, round_label, data_source)
  values (g, tour, 'live', now() - interval '20 minutes', now() - interval '20 minutes', 3, 'Demi-finale', 'demo') returning id into m;
  insert into public.match_teams (match_id, slot, team_id, score) values (m, 1, t3, 1), (m, 2, t2, 0);

  -- Match à venir
  insert into public.matches (game_id, tournament_id, status, scheduled_at, best_of, round_label, data_source)
  values (g, tour, 'scheduled', now() + interval '2 days', 5, 'Finale', 'demo') returning id into m;
  insert into public.match_teams (match_id, slot, team_id) values (m, 1, t1), (m, 2, null);
  update public.match_teams set placeholder_label = 'Vainqueur demi-finale 2' where match_id = m and slot = 2;
end $$;
