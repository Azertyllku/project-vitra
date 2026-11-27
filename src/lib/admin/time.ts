const PARIS = 'Europe/Paris';

/** Valeur d'un <input type="datetime-local"> saisie à l'heure de Paris → instant UTC (ISO). */
export function parisInputToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(asUtc)) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: PARIS, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(asUtc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const parisAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(asUtc - (parisAsUtc - asUtc)).toISOString();
}

/** Instant ISO → valeur pour un <input type="datetime-local"> à l'heure de Paris. */
export function isoToParisInput(iso: unknown): string {
  if (typeof iso !== 'string') return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('sv-SE', { timeZone: PARIS }).replace(' ', 'T').slice(0, 16);
}

export const formatParis = (iso: unknown): string => {
  if (typeof iso !== 'string') return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { timeZone: PARIS, dateStyle: 'short', timeStyle: 'short' });
};
