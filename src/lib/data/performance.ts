import { createClient } from '@/lib/supabase/server';

export const PERIODS = [
  { key: '7j', label: '7 jours', days: 7 },
  { key: '30j', label: '30 jours', days: 30 },
  { key: '90j', label: '90 jours', days: 90 },
  { key: '6m', label: '6 mois', days: 182 },
  { key: '1a', label: '1 an', days: 365 },
  { key: 'carriere', label: 'Carrière', days: null },
] as const;
export type Period = (typeof PERIODS)[number];

/** Périodes accessibles sans abonnement ; les analyses historiques approfondies sont Premium. */
export const FREE_PERIOD_KEYS: string[] = ['7j', '30j', '90j'];

export function findPeriod(key: string | undefined): Period {
  return PERIODS.find((p) => p.key === key) ?? PERIODS[1];
}

/** Date ISO d'il y a `days * factor` jours ; null pour la carrière entière. */
export function sinceDays(days: number | null, factor = 1): string | null {
  return days == null ? null : new Date(Date.now() - days * factor * 86_400_000).toISOString();
}

export interface Dim {
  name: string;
  played: number;
  wins: number;
}

export interface Performance {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  seconds: number;
  streak: { kind: 'win' | 'loss' | null; length: number };
  by_source: Record<string, number>;
  by_map: Dim[];
  by_character: Dim[];
  by_role: Dim[];
  by_day: { day: string; played: number; wins: number; losses: number }[];
  stat_averages: Record<string, { avg: number; n: number }>;
}

/** Agrégats calculés par la base (fonction account_performance) ; la RLS de l'utilisateur s'applique. */
export async function fetchPerformance(accountId: string, since: string | null): Promise<Performance | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('account_performance', { _account: accountId, _since: since });
  if (error || !data) return null;
  return data as Performance;
}

/** Taux de victoire en % (parties décidées uniquement) ; null s'il n'y a aucune partie décidée. */
export function winRate(p: { wins: number; losses: number; draws: number }): number | null {
  const decided = p.wins + p.losses + p.draws;
  return decided > 0 ? Math.round((p.wins / decided) * 1000) / 10 : null;
}

export function formatPlaytime(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
