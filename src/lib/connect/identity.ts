import { siteUrl } from '@/lib/env';
import type { ProviderId } from './providers';

/** Identité de jeu prouvée par le fournisseur : c'est ce qui est enregistré comme compte vérifié. */
export interface Identity {
  provider: string;
  externalId: string;
  displayName: string | null;
}

const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
const TIMEOUT = 10_000;

/* ---------- Steam (OpenID 2.0, aucune clé requise) ---------- */

const STEAM_ID64_BASE = '76561197960265728';
const STEAM_ENDPOINT = 'https://steamcommunity.com/openid/login';

export const steamReturnTo = (state: string, game: string) => `${siteUrl()}/api/connect/steam/callback?state=${state}&game=${game}`;

export function steamAuthorizeUrl(state: string, game: string): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': steamReturnTo(state, game),
    'openid.realm': siteUrl(),
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `${STEAM_ENDPOINT}?${params.toString()}`;
}

async function steamPersonaName(steamId: string): Promise<string | null> {
  const key = process.env.STEAM_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`, { signal: AbortSignal.timeout(TIMEOUT), cache: 'no-store' });
    if (!response.ok) return null;
    const data = (await response.json()) as { response?: { players?: { personaname?: string }[] } };
    return str(data.response?.players?.[0]?.personaname);
  } catch {
    return null;
  }
}

/** Vérifie auprès de Steam que l'assertion OpenID est authentique (et non rejouable). */
export async function verifySteam(url: URL, state: string, game: string): Promise<Identity | null> {
  const p = url.searchParams;
  if (p.get('openid.mode') !== 'id_res') return null;
  if (p.get('openid.op_endpoint') !== STEAM_ENDPOINT) return null;
  if (p.get('openid.return_to') !== steamReturnTo(state, game)) return null;
  const claimed = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(p.get('openid.claimed_id') ?? '');
  if (!claimed) return null;

  const body = new URLSearchParams();
  p.forEach((value, key) => {
    if (key.startsWith('openid.')) body.set(key, value);
  });
  body.set('openid.mode', 'check_authentication');
  const response = await fetch(STEAM_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(TIMEOUT),
    cache: 'no-store',
  });
  if (!response.ok || !/is_valid\s*:\s*true/.test(await response.text())) return null;

  const steamId = claimed[1];
  const name = await steamPersonaName(steamId);
  // Dota 2 : le connecteur de synchronisation (OpenDota) utilise l'ID de compte 32 bits.
  if (game === 'dota-2') {
    return { provider: 'opendota', externalId: (BigInt(steamId) - BigInt(STEAM_ID64_BASE)).toString(), displayName: name };
  }
  return { provider: 'steam', externalId: steamId, displayName: name };
}

/* ---------- OAuth 2.0 (Riot, Battle.net, Epic) : nécessitent des clés d'application ---------- */

type OAuthProvider = Exclude<ProviderId, 'steam'>;

const OAUTH: Record<OAuthProvider, { authorize: string; token: string; scope: string; idKey: string; secretKey: string }> = {
  riot: { authorize: 'https://auth.riotgames.com/authorize', token: 'https://auth.riotgames.com/token', scope: 'openid', idKey: 'RIOT_CLIENT_ID', secretKey: 'RIOT_CLIENT_SECRET' },
  blizzard: { authorize: 'https://oauth.battle.net/authorize', token: 'https://oauth.battle.net/token', scope: 'openid', idKey: 'BLIZZARD_CLIENT_ID', secretKey: 'BLIZZARD_CLIENT_SECRET' },
  epic: { authorize: 'https://www.epicgames.com/id/authorize', token: 'https://api.epicgames.dev/epic/oauth/v2/token', scope: 'basic_profile', idKey: 'EPIC_CLIENT_ID', secretKey: 'EPIC_CLIENT_SECRET' },
};

const redirectUri = (provider: OAuthProvider) => `${siteUrl()}/api/connect/${provider}/callback`;

export function authorizeUrl(provider: OAuthProvider, state: string): string {
  const cfg = OAUTH[provider];
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env[cfg.idKey] ?? '',
    redirect_uri: redirectUri(provider),
    scope: cfg.scope,
    state,
  });
  return `${cfg.authorize}?${params.toString()}`;
}

async function getJson(url: string, token: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT), cache: 'no-store' });
  return response.ok ? ((await response.json()) as Record<string, unknown>) : null;
}

/** Échange le code d'autorisation puis lit l'identité du joueur chez le fournisseur. */
export async function exchangeOAuth(provider: OAuthProvider, code: string | null): Promise<Identity | null> {
  if (!code) return null;
  const cfg = OAUTH[provider];
  const basic = Buffer.from(`${process.env[cfg.idKey] ?? ''}:${process.env[cfg.secretKey] ?? ''}`).toString('base64');
  const tokenResponse = await fetch(cfg.token, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(provider) }),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: 'no-store',
  });
  if (!tokenResponse.ok) return null;
  const token = str(((await tokenResponse.json()) as Record<string, unknown>).access_token);
  if (!token) return null;

  if (provider === 'riot') {
    const account = await getJson('https://europe.api.riotgames.com/riot/account/v1/accounts/me', token);
    const puuid = str(account?.puuid);
    if (!account || !puuid) return null;
    const gameName = str(account.gameName);
    const tagLine = str(account.tagLine);
    return { provider: 'riot', externalId: puuid, displayName: gameName ? `${gameName}${tagLine ? `#${tagLine}` : ''}` : null };
  }
  if (provider === 'blizzard') {
    const info = await getJson('https://oauth.battle.net/userinfo', token);
    const id = info?.id ?? info?.sub;
    if (!info || id == null) return null;
    return { provider: 'blizzard', externalId: String(id), displayName: str(info.battletag) };
  }
  const info = await getJson('https://api.epicgames.dev/epic/oauth/v2/userInfo', token);
  const sub = str(info?.sub);
  if (!info || !sub) return null;
  return { provider: 'epic', externalId: sub, displayName: str(info.preferred_username) };
}
