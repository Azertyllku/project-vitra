import { formatParis } from './time';

export interface Option { value: string; label: string }
export type FieldType = 'text' | 'textarea' | 'slug' | 'url' | 'country' | 'currency' | 'color' | 'number' | 'integer' | 'datetime' | 'checkbox' | 'select' | 'relation';

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
  fields: Field[];
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

const common = {
  logo: { name: 'logo_url', label: 'Logo (URL)', type: 'url' } as Field,
  banner: { name: 'banner_url', label: 'Bannière (URL)', type: 'url' } as Field,
};

export const ENTITIES: Record<string, EntityConfig> = {
  jeux: {
    key: 'jeux',
    table: 'games',
    singular: 'jeu',
    plural: 'Jeux',
    description: 'Catalogue des jeux suivis par la plateforme.',
    slugFrom: 'name',
    searchField: 'name',
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
      select: 'id, name, slug, genre, is_active, sort_order',
      orderBy: 'sort_order',
      ascending: true,
      headers: ['Nom', 'Genre', 'Actif', 'Ordre'],
      cells: (r) => [s(r.name), s(r.genre), yesNo(r.is_active), s(r.sort_order)],
    },
  },
  equipes: {
    key: 'equipes',
    table: 'teams',
    singular: 'équipe',
    plural: 'Équipes',
    description: 'Équipes et organisations esport.',
    slugFrom: 'name',
    searchField: 'name',
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
      select: 'id, name, slug, tag, country_code, is_active, created_at',
      orderBy: 'name',
      ascending: true,
      headers: ['Nom', 'Tag', 'Pays', 'Active'],
      cells: (r) => [s(r.name), s(r.tag), s(r.country_code), yesNo(r.is_active)],
    },
  },
  joueurs: {
    key: 'joueurs',
    table: 'players',
    singular: 'joueur',
    plural: 'Joueurs',
    description: 'Joueurs professionnels et amateurs.',
    slugFrom: 'nickname',
    searchField: 'nickname',
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
      select: 'id, nickname, slug, real_name, country_code, is_professional, is_active',
      orderBy: 'nickname',
      ascending: true,
      headers: ['Pseudo', 'Nom réel', 'Pays', 'Pro', 'Actif'],
      cells: (r) => [s(r.nickname), s(r.real_name), s(r.country_code), yesNo(r.is_professional), yesNo(r.is_active)],
    },
  },
  tournois: {
    key: 'tournois',
    table: 'tournaments',
    singular: 'tournoi',
    plural: 'Tournois',
    description: 'Compétitions : dates, format, dotation.',
    slugFrom: 'name',
    searchField: 'name',
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
    list: {
      select: 'id, name, slug, status, starts_at, game:games(name)',
      orderBy: 'starts_at',
      ascending: false,
      headers: ['Nom', 'Jeu', 'Statut', 'Début'],
      cells: (r) => [s(r.name), nested(r.game, 'name'), s(r.status), formatParis(r.starts_at)],
    },
  },
  matchs: {
    key: 'matchs',
    table: 'matches',
    singular: 'match',
    plural: 'Matchs',
    description: 'Programme, scores et statuts des rencontres.',
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
      select: 'id, status, scheduled_at, round_label, game:games(name), teams:match_teams(slot, score, team:teams(name))',
      orderBy: 'scheduled_at',
      ascending: false,
      headers: ['Date', 'Match', 'Jeu', 'Statut'],
      cells: (r) => {
        const teams = (Array.isArray(r.teams) ? [...(r.teams as Row[])] : []).sort((a, b) => Number(a.slot) - Number(b.slot));
        const label = teams.length ? teams.map((t) => `${nested(t.team, 'name')}${t.score != null ? ` (${t.score})` : ''}`).join(' vs ') : 'À déterminer';
        return [formatParis(r.scheduled_at), label, nested(r.game, 'name'), s(r.status)];
      },
    },
  },
};

export const ENTITY_ORDER = ['jeux', 'equipes', 'joueurs', 'tournois', 'matchs'];
