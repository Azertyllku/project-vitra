const TZ = 'Europe/Paris';

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Date à confirmer';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(iso));
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: TZ }).format(new Date(iso));
}

export function formatMoney(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency?.trim() || 'USD', maximumFractionDigits: 0 }).format(amount);
}

/** Drapeau à partir d'un code pays ISO à 2 lettres. */
export function flag(code: string | null): string {
  if (!code || code.trim().length !== 2) return '';
  return String.fromCodePoint(...[...code.trim().toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export const MATCH_STATUS_LABEL: Record<string, string> = {
  scheduled: 'À venir',
  live: 'En direct',
  finished: 'Terminé',
  postponed: 'Reporté',
  cancelled: 'Annulé',
};

export const TOURNAMENT_STATUS_LABEL: Record<string, string> = {
  upcoming: 'À venir',
  ongoing: 'En cours',
  finished: 'Terminé',
  cancelled: 'Annulé',
};

export const FORMAT_LABEL: Record<string, string> = {
  single_elimination: 'Élimination directe',
  double_elimination: 'Double élimination',
  round_robin: 'Round robin',
  swiss: 'Système suisse',
  groups_playoffs: 'Phase de groupes + playoffs',
  battle_royale: 'Battle royale',
  other: 'Autre',
};
