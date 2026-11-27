export type ProviderId = 'steam' | 'riot' | 'blizzard' | 'epic';

export interface ProviderDef {
  id: ProviderId;
  label: string;
  /** Jeux dont le compte peut être vérifié avec ce fournisseur (slugs du catalogue). */
  games: string[];
  /** Variables d'environnement serveur nécessaires (vide : aucune clé requise). */
  envKeys: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  steam: { id: 'steam', label: 'Steam', games: ['counter-strike-2', 'dota-2', 'pubg', 'apex-legends'], envKeys: [] },
  riot: { id: 'riot', label: 'Riot Games', games: ['league-of-legends', 'valorant', 'teamfight-tactics'], envKeys: ['RIOT_CLIENT_ID', 'RIOT_CLIENT_SECRET'] },
  blizzard: { id: 'blizzard', label: 'Battle.net (Blizzard)', games: ['overwatch-2', 'starcraft-ii', 'call-of-duty'], envKeys: ['BLIZZARD_CLIENT_ID', 'BLIZZARD_CLIENT_SECRET'] },
  epic: { id: 'epic', label: 'Epic Games', games: ['fortnite', 'rocket-league'], envKeys: ['EPIC_CLIENT_ID', 'EPIC_CLIENT_SECRET'] },
};

export const isProviderId = (value: string): value is ProviderId => value in PROVIDERS;

/** Vrai si toutes les clés du fournisseur sont renseignées (serveur uniquement). */
export const isConfigured = (def: ProviderDef) => def.envKeys.every((key) => Boolean(process.env[key]));

export const ACCOUNT_PROVIDER_LABEL: Record<string, string> = {
  steam: 'Steam',
  riot: 'Riot Games',
  blizzard: 'Battle.net',
  epic: 'Epic Games',
  opendota: 'OpenDota (Steam)',
  manual: 'Déclaré manuellement',
};
