/**
 * Contrat commun des connecteurs de données par jeu.
 * Un connecteur déclare ce qu'il sait réellement fournir (capabilities) :
 * tout le reste doit s'afficher comme « indisponible », jamais être inventé.
 */
export interface NormalizedMatch {
  externalMatchId: string;
  playedAt: string; // ISO 8601
  result: 'win' | 'loss' | 'draw' | 'unknown';
  mapName?: string;
  characterName?: string;
  roleName?: string;
  durationSeconds?: number;
  stats: Record<string, number | string>; // clés définies dans game_statistics_definitions
}

export interface GameConnector {
  provider: string;
  capabilities: { profile: boolean; matchHistory: boolean; rank: boolean };
  fetchMatches(account: { externalId: string; region?: string }, since?: Date): Promise<NormalizedMatch[]>;
}

// Registre : un connecteur par jeu/fournisseur, ajoutés au fil des phases (clé API requise).
export const connectors: Record<string, GameConnector> = {};
