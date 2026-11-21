import { createClient } from '@/lib/supabase/server';
import type { MatchRow, MatchStatus } from './types';

const BASE = 'id, game_id, status, scheduled_at, started_at, ended_at, best_of, round_label, data_source';
const TEAMS =
  'teams:match_teams(slot, score, placement, is_winner, placeholder_label, team:teams(id, slug, name, tag, logo_url, country_code))';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MatchQuery {
  status?: MatchStatus | MatchStatus[];
  gameSlug?: string;
  tournamentId?: string;
  ids?: string[];
  limit?: number;
  offset?: number;
  ascending?: boolean;
}

function normalize(match: MatchRow): MatchRow {
  return { ...match, teams: [...(match.teams ?? [])].sort((a, b) => a.slot - b.slot) };
}

/** Liste de matchs. Récupère limit+1 lignes pour savoir s'il existe une page suivante. */
export async function fetchMatches(opts: MatchQuery = {}): Promise<{ matches: MatchRow[]; hasMore: boolean; failed: boolean }> {
  const supabase = await createClient();
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const game = opts.gameSlug ? 'game:games!inner(slug, name)' : 'game:games(slug, name)';

  let query = supabase
    .from('matches')
    .select(`${BASE}, ${game}, tournament:tournaments(slug, name), ${TEAMS}`)
    .order('scheduled_at', { ascending: opts.ascending ?? false, nullsFirst: false });

  if (opts.status) query = Array.isArray(opts.status) ? query.in('status', opts.status) : query.eq('status', opts.status);
  if (opts.gameSlug) query = query.eq('game.slug', opts.gameSlug);
  if (opts.tournamentId) query = query.eq('tournament_id', opts.tournamentId);
  if (opts.ids) query = query.in('id', opts.ids);

  const { data, error } = await query.range(offset, offset + limit).returns<MatchRow[]>();
  const rows = (data ?? []).map(normalize);
  return { matches: rows.slice(0, limit), hasMore: rows.length > limit, failed: Boolean(error) };
}

export interface MatchDetail extends MatchRow {
  result: { winner_team_id: string | null; summary: Record<string, unknown>; finalized_at: string | null } | null;
}

export async function fetchMatch(id: string): Promise<MatchDetail | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('matches')
    .select(
      `${BASE}, game:games(slug, name), tournament:tournaments(slug, name), ${TEAMS}, result:match_results(winner_team_id, summary, finalized_at)`,
    )
    .eq('id', id)
    .maybeSingle<MatchDetail>();
  if (!data) return null;
  const result = Array.isArray(data.result) ? (data.result[0] ?? null) : data.result;
  return { ...normalize(data), result } as MatchDetail;
}

export interface StatDefinition {
  key: string;
  label: string;
  unit: string | null;
  display_order: number;
}

export interface MatchStatRow {
  id: string;
  map_number: number;
  stats: Record<string, number | string | null>;
  data_source: string;
  player: { slug: string; nickname: string } | null;
  team: { slug: string; name: string } | null;
}

/** Statistiques d'un match + définitions propres au jeu. Vide si le fournisseur n'en a pas livré. */
export async function fetchMatchStats(matchId: string, gameId: string) {
  const supabase = await createClient();
  const [stats, defs] = await Promise.all([
    supabase
      .from('match_statistics')
      .select('id, map_number, stats, data_source, player:players(slug, nickname), team:teams(slug, name)')
      .eq('match_id', matchId)
      .order('map_number')
      .returns<MatchStatRow[]>(),
    supabase
      .from('game_statistics_definitions')
      .select('key, label, unit, display_order')
      .eq('game_id', gameId)
      .eq('scope', 'player_match')
      .order('display_order')
      .returns<StatDefinition[]>(),
  ]);
  return { rows: stats.data ?? [], definitions: defs.data ?? [] };
}
