import type { GameConnector, NormalizedMatch } from './connectors.ts';

/**
 * Connecteur OpenDota (Dota 2) — API publique tierce, sans clé (quota gratuit limité).
 * Les données sont donc marquées « imported » (jamais « official »).
 * Prérequis côté joueur : activer « Exposer les données publiques des matchs » dans Dota 2.
 */
const BASE = 'https://api.opendota.com/api';

interface RecentMatch {
  match_id: number;
  player_slot: number;
  radiant_win?: boolean;
  duration: number;
  start_time: number;
  hero_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min?: number;
  xp_per_min?: number;
  last_hits?: number;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (response.status === 429) throw new Error('Limite de requêtes OpenDota atteinte, réessayez plus tard.');
  if (!response.ok) throw new Error(`OpenDota a répondu avec le statut ${response.status}.`);
  return response.json();
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const opendota: GameConnector = {
  provider: 'opendota',
  gameSlug: 'dota-2',
  dataSource: 'imported',
  capabilities: { profile: false, matchHistory: true, rank: false },
  validateExternalId: (id) => /^[0-9]{1,12}$/.test(id),

  async fetchMatches(account) {
    const matches = await getJson(`${BASE}/players/${account.externalId}/recentMatches`);
    if (!Array.isArray(matches)) {
      throw new Error('Profil Dota 2 introuvable ou privé : activez l’exposition des données publiques de vos matchs.');
    }

    // Noms des héros : facultatif, un échec n'empêche pas l'import.
    const heroNames = new Map<number, string>();
    try {
      const heroes = await getJson(`${BASE}/heroes`);
      if (Array.isArray(heroes)) {
        for (const hero of heroes as { id?: number; localized_name?: string }[]) {
          if (finite(hero.id) && typeof hero.localized_name === 'string') heroNames.set(hero.id, hero.localized_name);
        }
      }
    } catch {
      // noms de héros indisponibles
    }

    return (matches as RecentMatch[]).flatMap((m): NormalizedMatch[] => {
      if (!finite(m.match_id) || !finite(m.start_time) || !finite(m.player_slot)) return [];
      const stats: Record<string, number> = {};
      const put = (key: string, value: unknown) => {
        if (finite(value) && value >= 0) stats[key] = value;
      };
      put('kills', m.kills);
      put('deaths', m.deaths);
      put('assists', m.assists);
      put('gpm', m.gold_per_min);
      put('xpm', m.xp_per_min);
      put('last_hits', m.last_hits);

      // player_slot < 128 : équipe Radiant. Sans radiant_win, le résultat reste inconnu.
      const result = typeof m.radiant_win === 'boolean' ? (m.radiant_win === m.player_slot < 128 ? 'win' : 'loss') : 'unknown';
      return [
        {
          externalMatchId: String(m.match_id),
          playedAt: new Date(m.start_time * 1000).toISOString(),
          result,
          characterName: heroNames.get(m.hero_id),
          durationSeconds: finite(m.duration) && m.duration > 0 ? Math.round(m.duration) : undefined,
          stats,
        },
      ];
    });
  },
};
