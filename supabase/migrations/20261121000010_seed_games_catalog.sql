-- Migration 010 : catalogue initial des jeux (noms réels, aucune statistique ni match). Idempotent.
insert into public.games (slug, name, short_name, genre, accent_color, sort_order) values
  ('counter-strike-2',     'Counter-Strike 2',     'CS2',      'FPS tactique',    '#f59e0b', 10),
  ('league-of-legends',    'League of Legends',    'LoL',      'MOBA',            '#3b82f6', 20),
  ('valorant',             'Valorant',             'VAL',      'FPS tactique',    '#ef4444', 30),
  ('rocket-league',        'Rocket League',        'RL',       'Sport / voitures','#06b6d4', 40),
  ('fortnite',             'Fortnite',             'FN',       'Battle royale',   '#a855f7', 50),
  ('dota-2',               'Dota 2',               'Dota 2',   'MOBA',            '#dc2626', 60),
  ('overwatch-2',          'Overwatch 2',          'OW2',      'FPS de héros',    '#f97316', 70),
  ('rainbow-six-siege',    'Rainbow Six Siege',    'R6',       'FPS tactique',    '#64748b', 80),
  ('call-of-duty',         'Call of Duty',         'CoD',      'FPS',             '#16a34a', 90),
  ('apex-legends',         'Apex Legends',         'Apex',     'Battle royale',   '#e11d48', 100),
  ('pubg',                 'PUBG',                 'PUBG',     'Battle royale',   '#ca8a04', 110),
  ('ea-sports-fc',         'EA Sports FC',         'FC',       'Football',        '#22c55e', 120),
  ('street-fighter-6',     'Street Fighter 6',     'SF6',      'Combat',          '#eab308', 130),
  ('teamfight-tactics',    'Teamfight Tactics',    'TFT',      'Auto-battler',    '#8b5cf6', 140),
  ('starcraft-ii',         'StarCraft II',         'SC2',      'Stratégie temps réel', '#2563eb', 150)
on conflict (slug) do nothing;
