export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
export type DataSource = 'official' | 'imported' | 'manual' | 'demo';

export interface GameLite {
  slug: string;
  name: string;
}

export interface GameRow extends GameLite {
  id: string;
  short_name: string | null;
  description: string | null;
  genre: string | null;
  logo_url: string | null;
  banner_url: string | null;
  accent_color: string | null;
}

export interface TeamLite {
  id: string;
  slug: string;
  name: string;
  tag: string | null;
  logo_url: string | null;
  country_code: string | null;
}

export interface MatchTeam {
  slot: number;
  score: number | null;
  placement: number | null;
  is_winner: boolean | null;
  placeholder_label: string | null;
  team: TeamLite | null;
}

export interface MatchRow {
  id: string;
  game_id: string;
  status: MatchStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  best_of: number | null;
  round_label: string | null;
  data_source: DataSource;
  game: GameLite | null;
  tournament: { slug: string; name: string } | null;
  teams: MatchTeam[];
}

export interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  organizer: string | null;
  format: string;
  status: 'upcoming' | 'ongoing' | 'finished' | 'cancelled';
  region: string | null;
  starts_at: string | null;
  ends_at: string | null;
  prize_pool: number | null;
  currency: string | null;
  logo_url: string | null;
  description: string | null;
  data_source: DataSource;
  game: GameLite | null;
}

export interface PlayerLite {
  id: string;
  slug: string;
  nickname: string;
  real_name: string | null;
  country_code: string | null;
  photo_url: string | null;
  is_professional: boolean;
}

export interface StandingRow {
  team: TeamLite;
  played: number;
  wins: number;
  losses: number;
  winRate: number;
}
