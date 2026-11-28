import { parisInputToIso } from './time';

export const slugify = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  error: string | null;
}

/** Lecture d'un CSV (séparateur , ; ou tabulation détecté sur l'en-tête, guillemets doubles, BOM et CRLF acceptés). */
export function parseCsv(raw: string): ParsedCsv {
  const input = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const firstLine = input.split('\n', 1)[0] ?? '';
  const count = (char: string) => firstLine.split(char).length - 1;
  const delimiter = [';', '\t', ','].reduce((best, char) => (count(char) > count(best) ? char : best), ',');

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  if (quoted) return { headers: [], rows: [], error: 'Guillemet non refermé dans le fichier.' };
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const filled = records.filter((cells) => cells.some((cell) => cell.trim() !== ''));
  if (filled.length < 2) return { headers: [], rows: [], error: 'Le fichier doit contenir une ligne d’en-tête et au moins une ligne de données.' };
  const headers = filled[0].map((header) => header.trim().toLowerCase());
  const rows = filled.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? '').trim()])));
  return { headers, rows, error: null };
}

/** Date seule « AAAA-MM-JJ » valide, sinon null. */
export function toDate(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

/** Instant ISO depuis « AAAA-MM-JJ HH:mm » (heure de Paris), « AAAA-MM-JJ » (minuit à Paris) ou une date avec fuseau (Z, +01:00). */
export function toInstant(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(v)) {
    const date = new Date(v.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const local = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2})?$/.exec(v);
  if (local) return parisInputToIso(`${local[1]}T${local[2]}`);
  if (toDate(v)) return parisInputToIso(`${v}T00:00`);
  return null;
}
