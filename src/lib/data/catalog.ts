import { createClient } from '@/lib/supabase/server';
import type { GameRow, StandingRow, TeamLite } from './types';

const GAME_COLUMNS = 'id, slug, name, short_name, description, genre, logo_url, banner_url, accent_color';

export async function fetchGames(): Promise<{ games: GameRow[]; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('is_active', true)
    .order('sort_order')
    .returns<GameRow[]>();
  return { games: data ?? [], failed: Boolean(error) };
}

export async function fetchGameBySlug(slug: string): Promise<GameRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle<GameRow>();
  return data;
}

/** Classement d'équipes d'un jeu, calculé à partir des matchs terminés enregistrés (vue team_standings). */
export async function fetchStandings(gameId: string, limit = 100): Promise<{ rows: StandingRow[]; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('team_standings')
    .select('team_id, played, wins, losses')
    .eq('game_id', gameId)
    .order('wins', { ascending: false })
    .limit(limit)
    .returns<{ team_id: string; played: number; wins: number; losses: number }[]>();
  if (error || !data || data.length === 0) return { rows: [], failed: Boolean(error) };

  const { data: teams } = await supabase
    .from('teams')
    .select('id, slug, name, tag, logo_url, country_code')
    .in('id', data.map((row) => row.team_id))
    .returns<TeamLite[]>();
  const byId = new Map((teams ?? []).map((team) => [team.id, team]));

  const rows: StandingRow[] = data.flatMap((row) => {
    const team = byId.get(row.team_id);
    if (!team) return [];
    const played = Number(row.played);
    const wins = Number(row.wins);
    return [{ team, played, wins, losses: Number(row.losses), winRate: played > 0 ? Math.round((wins / played) * 100) : 0 }];
  });
  rows.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.team.name.localeCompare(b.team.name));
  return { rows, failed: false };
}
