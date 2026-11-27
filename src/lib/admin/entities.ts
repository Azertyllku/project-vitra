import { formatParis } from './time';

export interface Option { value: string; label: string }
export type FieldType = 'text' | 'textarea' | 'slug' | 'url' | 'country' | 'currency' | 'lang' | 'color' | 'number' | 'integer' | 'date' | 'datetime' | 'checkbox' | 'select' | 'relation';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  options?: Option[];
  relation?: { table: string; label: string };
  min?: number;
  max?: number;
  default?: string | boolean;
  /** Champ géré à part (hors de la table principale). */
  virtual?: boolean;
}

type Row = Record<string, unknown>;

export interface EntityConfig {
  key: string;
  table: string;
  singular: string;
  plural: string;
  description: string;
  slugFrom?: string;
  searchField?: string;
  /** Liste seule : aucune création ni modification. */
  readOnly?: boolean;
  fields: Field[];
  /** Règles entre champs, appliquées après la validation de chaque champ. */
  validate?: (values: Row) => Record<string, string>;
  list: { select: string; orderBy: string; ascending: boolean; headers: string[]; cells: (row: Row) => string[] };
}

export interface FormState { ok: boolean; message: string | null; fieldErrors?: Record<string, string> }

const s = (value: unknown): string => (value == null || value === '' ? '—' : String(value));
const nested = (value: unknown, key: string): string => {
  const object = Array.isArray(value) ? value[0] : value;
  return object && typeof object === 'object' ? s((object as Row)[key]) : '—';
};
const yesNo = (value: unknown) => (value ? 'Oui' : 'Non');

const DATA_SOURCES: Option[] = [
  { value: 'manual', label: 'Saisie manuelle' },
  { value: 'official', label: 'Source officielle' },
  { value: 'imported', label: 'Import' },
  { value: 'demo', label: 'Démonstration' },
];
const RIGHTS: Option[] = [
  { value: 'pending', label: 'En attente de validation' },
  { value: 'authorized', label: 'Autorisé (visible du public)' },
  { value: 'revoked', label: 'Retiré' },
];
const RIGHTS_HELP = 'Un contenu n’est visible du public que s’il est « autoris» et que le titulaire des droits est indiqué.';

/** Formats acceptés par la base pour chaque type de source vidéo. */
const EMBED_RULES: Record<string, { pattern: RegExp; hint: string }> = {
  twitch_channel: { pattern: /^[A-Za-z0-9_]{3,25}$/, hint: 'nom de chaîne Twitch (3 à 25 caractères)' },
  twitch_video: { pattern: /^[0-9]{5,15}$/, hint: 'identifiant numérique de la vidéo Twitch' },
  youtube_video: { pattern: /^[A-Za-z0-9_-]{11}$/, hint: 'identifiant YouTube à 11 caractères' },
  hls: { pattern: /^https:\/\/[^\s"'<>]+$/, hint: 'URL https du flux HLS' },
};

function mediaRules(values: Row): Record<string, string> {
  const errors: Record<string, string> = {};
  const rule = EMBED_RULES[String(values.provider)];
  if (rule && typeof values.embed_ref === 'string' && !rule.pattern.test(values.embed_ref)) errors.embed_ref = `Format attendu : ${rule.hint}.`;
  if (values.rights_status === 'authorized' && !values.rights_holder) errors.rights_holder = 'Titulaire des droits obligatoire pour un contenu autorisé.';
  return errors;
}

const common = {
  logo: { name: 'logo_url', label: 'Logo (URL)', type: 'url' } as Field,
  banner: { name: 'banner_url', label: 'Bannière (URL)', type: 'url' } as Field,
};

const PROVIDERS_LIVE: Option[] = [
  { value: 'twitch_channel', label: 'Chaîne Twitch (direct)' },
  { value: 'twitch_video', label: 'Vidéo Twitch' },
  { value: 'youtube_video', label: 'Vidéo YouTube' },
  { value: 'hls', label: 'Flux HLS (URL https)' },
];

const ADMIN_ACTION_LABEL: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  grant_role: 'Rôle accordé',
  revoke_role: 'Rôle retiré',
  sanction: 'Sanction',
  lift_sanction: 'Sanction levée',
  setting: 'Réglage',
};

export const ENTITIES: Record<string, EntityConfig> = {
  jeux: {
    key: 'jeux', table: 'games', singular: 'jeu', plural: 'Jeux', description: 'Catalogue des jeux suivis par la plateforme.',
    slugFrom: 'name', searchField: 'name',
    fields: [
      { name: 'name', label: 'Nom', type: 'text', required: true, max: 80 },
      { name: 'slug', label: 'Identifiant d\u2019URL', type: 'slug', help: 'Laissé vide, il est déduit du nom. Lettres minuscules, chiffres et tirets.' },
      { name: 'short_name', label: 'Nom court', type: 'text', max: 30 },
      { name: 'genre', label: 'Genre', type: 'text', max: 60 },
      { name: 'description', label: 'Description', type: 'textarea' },
      common.logo,
      common.banner,
      { name: 'accent_color', label: 'Couleur d\u2019accent', type: 'color', help: 'Format #RRGGBB, par exemple #7C3AED.' },
      { name: 'sort_order', label: 'Ordre d\u2019affichage', type: 'integer', min: 0, max: 9999, default: '100' },
      { name: 'is_active', label: 'Actif (visible sur le site)', type: 'checkbox', default: true },
    ],
    list: {
      select: 'id, name, slug, genre, is_active, sort_order', orderBy: 'sort_order', ascending: true,
      headers: ['Nom', 'Genre', 'Actif', 'Ordre'],
      cells: (r) => [s(r.name), s(r.genre), yesNo(r.is_active), s(r.sort_order)],
    },
  },
  equipes: {
    key: 'equipes', table: 'teams', singular: 'équipe', plural: 'Équipes', description: 'Équipes et organisations esport.',
    slugFrom: 'name', searchField: 'name',
    fields: [
      { name: 'name', label: 'Nom', type: 'text', required: true, max: 80 },
      { name: 'slug', label: 'Identifiant d\u2019URL', type: 'slug', help: 'Laissé vide, il est déduit du nom.' },
      { name: 'tag', label: 'Tag', type: 'text', max: 10 },
      { name: 'country_code', label: 'Pays (code à 2 lettres)', type: 'country' },
      common.logo,
      common.banner,
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', default: true },
    ],
    list: {
      select: 'id, name, slug, tag, country_code, is_active, created_at', orderBy: 'name', ascending: true,
      headers: ['Nom', 'Tag', 'Pays', 'Active'],
      cells: (r) => [s(r.name), s(r.tag), s(r.country_code), yesNo(r.is_active)],
    },
  },
  joueurs: {
    key: 'joueurs', table: 'players', singular: 'joueur', plural: 'Joueurs', description: 'Joueurs professionnels et amateurs.',
    slugFrom: 'nickname', searchField: 'nickname',
    fields: [
      { name: 'nickname', label: 'Pseudo', type: 'text', required: true, max: 40 },
      { name: 'slug', label: 'Identifiant d\u2019URL', type: 'slug', help: 'Laissé vide, il est déduit du pseudo.' },
      { name: 'real_name', label: 'Nom réel', type: 'text', max: 80 },
      { name: 'country_code', label: 'Pays (code à 2 lettres)', type: 'country' },
      { name: 'photo_url', label: 'Photo (URL)', type: 'url' },
      common.banner,
      { name: 'bio', label: 'Biographie', type: 'textarea' },
      { name: 'is_professional', label: 'Joueur professionnel', type: 'checkbox', default: true },
      { name: 'is_active', label: 'Actif', type: 'checkbox', default: true },
    ],
    list: {
      select: 'id, nickname, slug, real_name, country_code, is_professional, is_active', orderBy: 'nickname', ascending: true,
      headers: ['Pseudo', 'Nom réel', 'Pays', 'Pro', 'Actif'],
      cells: (r) => [s(r.nickname), s(r.real_name), s(r.country_code), yesNo(r.is_professional), yesNo(r.is_active)],
    },
  },
  effectifs: {
    key: 'effectifs', table: 'team_members', singular: 'effectif', plural: 'Effectifs', description: 'Joueurs et staff de chaque équipe, par jeu. Pour un transfert : renseignez la date de départ dans l\u2019ancienne équipe, puis ajoutez le joueur dans la nouvelle.',
    fields: [
      { name: 'team_id', label: 'Équipe', type: 'relation', required: true, relation: { table: 'teams', label: 'name' } },
      { name: 'player_id', label: 'Joueur', type: 'relation', required: true, relation: { table: 'players', label: 'nickname' } },
      { name: 'game_id', label: 'Jeu', type: 'relation', required: true, relation: { table: 'games', label: 'name' } },
      {
        name: 'role', label: 'Rôle', type: 'select', default: 'player',
        options: [
          { value: 'player', label: 'Joueur' },
          { value: 'substitute', label: 'Remplaçant' },
          { value: 'coach', label: 'Coach' },
          { value: 'analyst', label: 'Analyste' },
          { value: 'manager', label: 'Manager' },
        ],
      },
      { name: 'joined_at', label: 'Arrivée', type: 'date' },
      { name: 'left_at', label: 'Départ (vide : toujours dans l\u2019équipe)', type: 'date' },
    ],
    validate: (v) => (typeof v.joined_at === 'string' && typeof v.left_at === 'string' && v.left_at < v.joined_at ? { left_at: 'Le départ doit suivre l\u2019arrivée.' } : {}),
    list: {
      select: 'id, role, joined_at, left_at, team:teams(name), player:players(nickname), game:games(name)', orderBy: 'joined_at', ascending: false,
      headers: ['Joueur', 'Équipe', 'Jeu', 'Rôle', 'Arrivée', 'Départ'],
      cells: (r) => [nested(r.player, 'nickname'), nested(r.team, 'name'), nested(r.game, 'name'), s(r.role), s(r.joined_at), s(r.left_at)],
    },
  },
  tournois: {
    key: 'tournois', table: 'tournaments', singular: 'tournoi', plural: 'Tournois', description: 'Compétitions : dates, format, dotation.',
    slugFrom: 'name', searchField: 'name',
    fields: [
      { name: 'name', label: 'Nom', type: 'text', required: true, max: 120 },
      { name: 'slug', label: 'Identifiant d\u2019URL', type: 'slug', help: 'Laissé vide, il est déduit du nom.' },
      { name: 'game_id', label: 'Jeu', type: 'relation', required: true, relation: { table: 'games', label: 'name' } },
      { name: 'organizer', label: 'Organisateur', type: 'text', max: 80 },
      {
        name: 'format', label: 'Format', type: 'select', default: 'single_elimination',
        options: [
          { value: 'single_elimination', label: 'Élimination directe' },
          { value: 'double_elimination', label: 'Double élimination' },
          { value: 'round_robin', label: 'Championnat (round robin)' },
          { value: 'swiss', label: 'Système suisse' },
          { value: 'groups_playoffs', label: 'Groupes puis playoffs' },
          { value: 'battle_royale', label: 'Battle royale' },
          { value: 'other', label: 'Autre' },
        ],
      },
      {
        name: 'status', label: 'Statut', type: 'select', default: 'upcoming',
        options: [
          { value: 'upcoming', label: 'À venir' },
          { value: 'ongoing', label: 'En cours' },
          { value: 'finished', label: 'Terminé' },
          { value: 'cancelled', label: 'Annulé' },
        ],
      },
      { name: 'region', label: 'Région', type: 'text', max: 60 },
      { name: 'starts_at', label: 'Début (heure de Paris)', type: 'datetime' },
      { name: 'ends_at', label: 'Fin (heure de Paris)', type: 'datetime' },
      { name: 'prize_pool', label: 'Dotation', type: 'number', min: 0 },
      { name: 'currency', label: 'Devise (3 lettres)', type: 'currency', default: 'EUR' },
      common.logo,
      common.banner,
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'data_source', label: 'Provenance des données', type: 'select', default: 'manual', options: DATA_SOURCES },
    ],
    validate: (v) => (typeof v.starts_at === 'string' && typeof v.ends_at === 'string' && v.ends_at < v.starts_at ? { ends_at: 'La fin doit être après le début.' } : {}),
    list: {
      select: 'id, name, slug, status, starts_at, game:games(name)', orderBy: 'starts_at', ascending: false,
      headers: ['Nom', 'Jeu', 'Statut', 'Début'],
      cells: (r) => [s(r.name), nested(r.game, 'name'), s(r.status), formatParis(r.starts_at)],
    },
  },
  phases: {
    key: 'phases', table: 'tournament_stages', singular: 'phase', plural: 'Phases', description: 'Phases d\u2019un tournoi (groupes, arbre, ligue…).',
    fields: [
      { name: 'tournament_id', label: 'Tournoi', type: 'relation', required: true, relation: { table: 'tournaments', label: 'name' } },
      { name: 'name', label: 'Nom de la phase', type: 'text', required: true, max: 80 },
      { name: 'stage_order', label: 'Ordre', type: 'integer', min: 1, max: 99, default: '1' },
      {
        name: 'stage_type', label: 'Type', type: 'select', default: 'bracket',
        options: [
          { value: 'groups', label: 'Phase de groupes' },
          { value: 'bracket', label: 'Arbre à élimination directe' },
          { value: 'double_bracket', label: 'Arbre double élimination' },
          { value: 'swiss', label: 'Système suisse' },
          { value: 'league', label: 'Ligue' },
        ],
      },
    ],
    list: {
      select: 'id, name, stage_order, stage_type, tournament:tournaments(name)', orderBy: 'stage_order', ascending: true,
      headers: ['Phase', 'Tournoi', 'Type', 'Ordre'],
      cells: (r) => [s(r.name), nested(r.tournament, 'name'), s(r.stage_type), s(r.stage_order)],
    },
  },
  groupes: {
    key: 'groupes', table: 'tournament_groups', singular: 'groupe', plural: 'Groupes', description: 'Groupes d\u2019une phase de tournoi.',
    fields: [
      { name: 'stage_id', label: 'Phase', type: 'relation', required: true, relation: { table: 'tournament_stages', label: 'name' } },
      { name: 'name', label: 'Nom du groupe', type: 'text', required: true, max: 60 },
    ],
    list: {
      select: 'id, name, stage:tournament_stages(name)', orderBy: 'name', ascending: true,
      headers: ['Groupe', 'Phase'],
      cells: (r) => [s(r.name), nested(r.stage, 'name')],
    },
  },
  participants: {
    key: 'participants', table: 'tournament_participants', singular: 'participant', plural: 'Participants', description: 'Équipes inscrites à un tournoi, avec tête de série, classement final et gains.',
    fields: [
      { name: 'tournament_id', label: 'Tournoi', type: 'relation', required: true, relation: { table: 'tournaments', label: 'name' } },
      { name: 'team_id', label: 'Équipe', type: 'relation', required: true, relation: { table: 'teams', label: 'name' } },
      { name: 'seed', label: 'Tête de série', type: 'integer', min: 1, max: 999 },
      { name: 'placement', label: 'Classement final', type: 'integer', min: 1, max: 999 },
      { name: 'prize', label: 'Gains', type: 'number', min: 0 },
    ],
    list: {
      select: 'id, seed, placement, prize, tournament:tournaments(name), team:teams(name)', orderBy: 'seed', ascending: true,
      headers: ['Tournoi', 'Équipe', 'Tête de série', 'Classement', 'Gains'],
      cells: (r) => [nested(r.tournament, 'name'), nested(r.team, 'name'), s(r.seed), s(r.placement), s(r.prize)],
    },
  },
  matchs: {
    key: 'matchs', table: 'matches', singular: 'match', plural: 'Matchs', description: 'Programme, scores et statuts des rencontres.',
    fields: [
      { name: 'game_id', label: 'Jeu', type: 'relation', required: true, relation: { table: 'games', label: 'name' } },
      { name: 'tournament_id', label: 'Tournoi (facultatif)', type: 'relation', relation: { table: 'tournaments', label: 'name' } },
      { name: 'team1', label: 'Équipe 1', type: 'relation', virtual: true, relation: { table: 'teams', label: 'name' } },
      { name: 'score1', label: 'Score équipe 1', type: 'integer', virtual: true, min: 0, max: 999 },
      { name: 'team2', label: 'Équipe 2', type: 'relation', virtual: true, relation: { table: 'teams', label: 'name' } },
      { name: 'score2', label: 'Score équipe 2', type: 'integer', virtual: true, min: 0, max: 999 },
      {
        name: 'status', label: 'Statut', type: 'select', default: 'scheduled',
        options: [
          { value: 'scheduled', label: 'Programmé' },
          { value: 'live', label: 'En direct' },
          { value: 'finished', label: 'Terminé' },
          { value: 'postponed', label: 'Reporté' },
          { value: 'cancelled', label: 'Annulé' },
        ],
      },
      { name: 'scheduled_at', label: 'Date et heure (heure de Paris)', type: 'datetime' },
      { name: 'best_of', label: 'Best of (1 à 9)', type: 'integer', min: 1, max: 9 },
      { name: 'round_label', label: 'Tour / phase', type: 'text', max: 60 },
      { name: 'data_source', label: 'Provenance des données', type: 'select', default: 'manual', options: DATA_SOURCES },
    ],
    list: {
      select: 'id, status, scheduled_at, round_label, game:games(name), teams:match_teams(slot, score, team:teams(name))', orderBy: 'scheduled_at', ascending: false,
      headers: ['Date', 'Match', 'Jeu', 'Statut'],
      cells: (r) => {
        const teams = (Array.isArray(r.teams) ? [...(r.teams as Row[])] : []).sort((a, b) => Number(a.slot) - Number(b.slot));
        const label = teams.length ? teams.map((t) => `${nested(t.team, 'name')}${t.score != null ? ` (${t.score})` : ''}`).join(' vs ') : 'À déterminer';
        return [formatParis(r.scheduled_at), label, nested(r.game, 'name'), s(r.status)];
      },
    },
  },
  diffusions: {
    key: 'diffusions', table: 'streams', singular: 'diffusion', plural: 'Diffusions', description: 'Événements en direct. Les flux vidéo se rattachent à une diffusion dans « Sources ».',
    searchField: 'title',
    fields: [
      { name: 'title', label: 'Titre', type: 'text', required: true, max: 140 },
      { name: 'game_id', label: 'Jeu', type: 'relation', required: true, relation: { table: 'games', label: 'name' } },
      { name: 'tournament_id', label: 'Tournoi (facultatif)', type: 'relation', relation: { table: 'tournaments', label: 'name' } },
      {
        name: 'status', label: 'Statut', type: 'select', default: 'scheduled',
        options: [
          { value: 'scheduled', label: 'Programmée' },
          { value: 'live', label: 'En direct' },
          { value: 'ended', label: 'Terminée' },
        ],
      },
      { name: 'starts_at', label: 'Début (heure de Paris)', type: 'datetime' },
      { name: 'ended_at', label: 'Fin (heure de Paris)', type: 'datetime' },
    ],
    list: {
      select: 'id, title, status, starts_at, game:games(name)', orderBy: 'starts_at', ascending: false,
      headers: ['Titre', 'Jeu', 'Statut', 'Début'],
      cells: (r) => [s(r.title), nested(r.game, 'name'), s(r.status), formatParis(r.starts_at)],
    },
  },
  sources: {
    key: 'sources', table: 'stream_sources', singular: 'source', plural: 'Sources de diffusion', description: 'Flux vidéo d\u2019une diffusion, avec gestion des droits de diffusion.',
    fields: [
      { name: 'stream_id', label: 'Diffusion', type: 'relation', required: true, relation: { table: 'streams', label: 'title' } },
      { name: 'provider', label: 'Type de source', type: 'select', required: true, default: 'twitch_channel', options: PROVIDERS_LIVE },
      { name: 'embed_ref', label: 'Référence', type: 'text', required: true, max: 500, help: 'Nom de chaîne Twitch, identifiant de vidéo, ou URL https du flux HLS selon le type.' },
      { name: 'label', label: 'Libellé affiché', type: 'text', max: 80 },
      { name: 'language', label: 'Langue (code à 2 lettres)', type: 'lang' },
      { name: 'is_official', label: 'Source officielle', type: 'checkbox' },
      { name: 'rights_status', label: 'Droits de diffusion', type: 'select', default: 'pending', options: RIGHTS, help: RIGHTS_HELP },
      { name: 'rights_holder', label: 'Titulaire des droits', type: 'text', max: 120 },
      { name: 'rights_note', label: 'Note sur les droits', type: 'textarea', max: 1000 },
      { name: 'sort_order', label: 'Ordre', type: 'integer', min: 0, max: 999, default: '0' },
    ],
    validate: mediaRules,
    list: {
      select: 'id, provider, embed_ref, rights_status, rights_holder, stream:streams(title)', orderBy: 'created_at', ascending: false,
      headers: ['Diffusion', 'Type', 'Référence', 'Droits', 'Titulaire'],
      cells: (r) => [nested(r.stream, 'title'), s(r.provider), s(r.embed_ref), s(r.rights_status), s(r.rights_holder)],
    },
  },
  rediffusions: {
    key: 'rediffusions', table: 'vods', singular: 'rediffusion', plural: 'Rediffusions', description: 'Vidéos à la demande (matchs complets, résumés, meilleurs moments) et leurs droits.',
    searchField: 'title',
    fields: [
      { name: 'title', label: 'Titre', type: 'text', required: true, max: 160 },
      { name: 'game_id', label: 'Jeu', type: 'relation', required: true, relation: { table: 'games', label: 'name' } },
      { name: 'tournament_id', label: 'Tournoi (facultatif)', type: 'relation', relation: { table: 'tournaments', label: 'name' } },
      {
        name: 'kind', label: 'Type de contenu', type: 'select', default: 'full',
        options: [
          { value: 'full', label: 'Match complet' },
          { value: 'highlight', label: 'Résumé / temps forts' },
          { value: 'best_play', label: 'Meilleure action' },
          { value: 'summary', label: 'Synthèse' },
        ],
      },
      { name: 'provider', label: 'Hébergeur', type: 'select', required: true, default: 'youtube_video', options: PROVIDERS_LIVE.filter((p) => p.value !== 'twitch_channel') },
      { name: 'embed_ref', label: 'Référence', type: 'text', required: true, max: 500, help: 'Identifiant de la vidéo (YouTube : 11 caractères ; Twitch : numérique) ou URL https HLS.' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'language', label: 'Langue (code à 2 lettres)', type: 'lang' },
      { name: 'duration_seconds', label: 'Durée (secondes)', type: 'integer', min: 1, max: 86400 },
      { name: 'thumbnail_url', label: 'Miniature (URL)', type: 'url' },
      { name: 'published_at', label: 'Publication (heure de Paris)', type: 'datetime' },
      { name: 'rights_status', label: 'Droits de diffusion', type: 'select', default: 'pending', options: RIGHTS, help: RIGHTS_HELP },
      { name: 'rights_holder', label: 'Titulaire des droits', type: 'text', max: 120 },
      { name: 'rights_note', label: 'Note sur les droits', type: 'textarea', max: 1000 },
    ],
    validate: mediaRules,
    list: {
      select: 'id, title, kind, provider, rights_status, published_at, game:games(name)', orderBy: 'published_at', ascending: false,
      headers: ['Titre', 'Jeu', 'Type', 'Droits', 'Publication'],
      cells: (r) => [s(r.title), nested(r.game, 'name'), s(r.kind), s(r.rights_status), formatParis(r.published_at)],
    },
  },
  integrations: {
    key: 'integrations', table: 'game_api_integrations', singular: 'intégration', plural: 'Sources de données', description: 'Connecteurs d\u2019API par jeu (réservé aux administrateurs). Les clés restent dans les secrets Supabase : ici, seul leur nom est noté.',
    fields: [
      { name: 'game_id', label: 'Jeu', type: 'relation', required: true, relation: { table: 'games', label: 'name' } },
      { name: 'provider', label: 'Fournisseur', type: 'text', required: true, max: 40, help: 'Par exemple opendota, riot, blizzard, pubg.' },
      {
        name: 'status', label: 'Statut', type: 'select', default: 'disabled',
        options: [
          { value: 'disabled', label: 'Désactivé' },
          { value: 'active', label: 'Actif' },
          { value: 'error', label: 'En erreur' },
        ],
      },
      { name: 'secret_name', label: 'Nom du secret', type: 'text', max: 80, help: 'Nom du secret Supabase qui contient la clé. Ne jamais saisir la clé elle-même.' },
    ],
    list: {
      select: 'id, provider, status, last_synced_at, game:games(name)', orderBy: 'created_at', ascending: false,
      headers: ['Jeu', 'Fournisseur', 'Statut', 'Dernière synchro'],
      cells: (r) => [nested(r.game, 'name'), s(r.provider), s(r.status), formatParis(r.last_synced_at)],
    },
  },
  synchronisations: {
    key: 'synchronisations', table: 'data_sync_logs', singular: 'synchronisation', plural: 'Journal des synchronisations', description: 'Historique des imports de données de jeu (lecture seule).',
    readOnly: true, fields: [],
    list: {
      select: 'id, provider, status, fetched_count, inserted_count, error_message, started_at', orderBy: 'started_at', ascending: false,
      headers: ['Début', 'Fournisseur', 'Statut', 'Récupérées / ajoutées', 'Erreur'],
      cells: (r) => [formatParis(r.started_at), s(r.provider), s(r.status), `${s(r.fetched_count)} / ${s(r.inserted_count)}`, s(r.error_message)],
    },
  },
  journal: {
    key: 'journal', table: 'admin_logs', singular: 'action', plural: 'Journal d\u2019administration', description: 'Qui a fait quoi dans l\u2019administration (lecture seule, réservé aux administrateurs).',
    readOnly: true, fields: [],
    list: {
      select: 'id, action, target_type, summary, created_at, actor:profiles(username)', orderBy: 'created_at', ascending: false,
      headers: ['Date', 'Auteur', 'Action', 'Cible', 'Détail'],
      cells: (r) => [formatParis(r.created_at), nested(r.actor, 'username'), ADMIN_ACTION_LABEL[String(r.action)] ?? s(r.action), s(r.target_type), s(r.summary)],
    },
  },
};

export const ENTITY_GROUPS: { title: string; keys: string[]; links?: { label: string; href: string }[] }[] = [
  { title: 'Contenu', keys: ['jeux', 'equipes', 'joueurs', 'effectifs', 'tournois', 'phases', 'groupes', 'participants', 'matchs'] },
  { title: 'Diffusion', keys: ['diffusions', 'sources', 'rediffusions'] },
  {
    title: 'Plateforme',
    keys: ['integrations', 'synchronisations', 'journal'],
    links: [{ label: 'Utilisateurs', href: '/admin/utilisateurs' }, { label: 'Réglages', href: '/admin/reglages' }],
  },
];
