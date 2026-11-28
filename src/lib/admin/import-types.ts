export interface ImportKind {
  label: string;
  description: string;
  /** Colonnes reconnues (* = obligatoire). */
  columns: string[];
  required: string[];
  /** Modèle : en-tête puis une ligne d'exemple à remplacer. */
  template: string;
}

export interface ImportIssue { line: number; message: string }

export interface ImportState {
  ok: boolean;
  message: string | null;
  dryRun: boolean;
  total: number;
  processed: number;
  ignored: number;
  issues: ImportIssue[];
}

export const IMPORT_KINDS: Record<string, ImportKind> = {
  equipes: {
    label: '1. Équipes',
    description: 'Crée ou met à jour des équipes (identifiées par leur slug, déduit du nom si absent).',
    columns: ['name*', 'slug', 'tag', 'country_code', 'logo_url', 'description'],
    required: ['name'],
    template: 'name,slug,tag,country_code,logo_url,description\nExemple Esport,exemple-esport,EXE,FR,,Équipe d\u2019exemple à remplacer',
  },
  joueurs: {
    label: '2. Joueurs',
    description: 'Crée ou met à jour des joueurs (slug déduit du pseudo : renseignez-le si deux joueurs ont le même pseudo).',
    columns: ['nickname*', 'slug', 'real_name', 'country_code', 'photo_url', 'bio', 'is_professional'],
    required: ['nickname'],
    template: 'nickname,slug,real_name,country_code,photo_url,bio,is_professional\nPseudoExemple,pseudoexemple,,FR,,,true',
  },
  effectifs: {
    label: '3. Effectifs',
    description: 'Rattache des joueurs à des équipes pour un jeu (équipes, joueurs et jeux référencés par leur slug). Les lignes déjà présentes sont ignorées.',
    columns: ['team*', 'player*', 'game*', 'role', 'joined_at', 'left_at'],
    required: ['team', 'player', 'game'],
    template: 'team,player,game,role,joined_at,left_at\nexemple-esport,pseudoexemple,counter-strike-2,player,2026-01-01,',
  },
  tournois: {
    label: '4. Tournois',
    description: 'Crée ou met à jour des tournois (slug déduit du nom si absent). Formats : single_elimination, double_elimination, round_robin, swiss, groups_playoffs, battle_royale, other. Statuts : upcoming, ongoing, finished, cancelled.',
    columns: ['name*', 'game*', 'slug', 'organizer', 'format', 'status', 'region', 'starts_at', 'ends_at', 'prize_pool', 'currency', 'description', 'logo_url'],
    required: ['name', 'game'],
    template: 'name,game,slug,organizer,format,status,region,starts_at,ends_at,prize_pool,currency,description,logo_url\nTournoi Exemple 2026,counter-strike-2,tournoi-exemple-2026,Organisateur,single_elimination,finished,International,2026-03-01,2026-03-08,100000,USD,,',
  },
  matchs: {
    label: '5. Matchs',
    description: 'Crée ou met à jour des matchs. La colonne ref (unique, ex. iem-2026-qf1) permet de réimporter sans doublon. Statuts : scheduled, finished, postponed, cancelled (par défaut : finished si les deux scores sont fournis).',
    columns: ['ref*', 'game*', 'team1*', 'team2*', 'score1', 'score2', 'status', 'scheduled_at', 'tournament', 'best_of', 'round'],
    required: ['ref', 'game', 'team1', 'team2'],
    template: 'ref,game,team1,team2,score1,score2,status,scheduled_at,tournament,best_of,round\ntournoi-exemple-2026-final,counter-strike-2,exemple-esport,autre-equipe,2,1,finished,2026-03-08 19:00,tournoi-exemple-2026,5,Finale',
  },
  rediffusions: {
    label: '6. Rediffusions',
    description: 'Crée ou met à jour des rediffusions. Par défaut les droits sont « pending » : le contenu reste invisible tant que vous ne passez pas rights_status à authorized avec un titulaire des droits. provider : youtube_video (11 caractères), twitch_video (numérique) ou hls (URL https).',
    columns: ['ref*', 'title*', 'game*', 'provider*', 'embed_ref*', 'kind', 'tournament', 'match_ref', 'language', 'published_at', 'duration_seconds', 'rights_status', 'rights_holder', 'rights_note', 'description', 'thumbnail_url'],
    required: ['ref', 'title', 'game', 'provider', 'embed_ref'],
    template: 'ref,title,game,provider,embed_ref,kind,tournament,match_ref,language,published_at,duration_seconds,rights_status,rights_holder,rights_note,description,thumbnail_url\nvod-exemple-final,Finale du Tournoi Exemple,counter-strike-2,youtube_video,AAAAAAAAAAA,full,tournoi-exemple-2026,tournoi-exemple-2026-final,en,2026-03-08 22:00,,pending,,Chaîne officielle de l\u2019organisateur,,',
  },
};
