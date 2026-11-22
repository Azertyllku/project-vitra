/**
 * Contrat commun des connecteurs de données par jeu.
 * Un connecteur déclare ce qu'il sait réellement fournir (capabilities) :
 * tout le reste doit s'afficher comme « indisponible », jamais être inventé.
 */
import { opendota } from './opendota.ts';

export interface NormalizedMatch {
  externalMatchId: string;
  playedAt: string; // ISO 8601
  result: 'win' | 'loss' | 'draw' | 'unknown';
  mapName?: string;
  characterName?: string;
  roleName?: string;
  durationSeconds?: number;
  stats: Record<string, number>; // clés définies dans game_statistics_definitions
}

export interface GameConnector {
  provider: string;
  /** Slug du jeu supporté (table games). */
  gameSlug: string;
  /** 'official' uniquement pour une API officielle de l'éditeur ; sinon 'imported'. */
  dataSource: 'official' | 'imported';
  capabilities: { profile: boolean; matchHistory: boolean; rank: boolean };
  validateExternalId(id: string): boolean;
  fetchMatches(account: { externalId: string; region?: string | null }, since?: Date): Promise<NormalizedMatch[]>;
}

// Registre : un connecteur par fournisseur, ajoutés au fil des phases (clé API requise pour la plupart).
export const connectors: Record<string, GameConnector> = {
  [opendota.provider]: opendota,
};
