type Param = string | string[] | undefined;

export const one = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);

export function pageNumber(value: Param): number {
  const n = Number.parseInt(one(value) ?? '1', 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1000) : 1;
}

/** Retire les caractères spéciaux des filtres PostgREST (ilike / or). */
export function cleanSearch(value: Param): string {
  return (one(value) ?? '').replace(/[%_,()\\]/g, ' ').trim().slice(0, 60);
}
