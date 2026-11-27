import { NextResponse, type NextRequest } from 'next/server';
import { PROVIDERS, isProviderId } from '@/lib/connect/providers';
import { exchangeOAuth, verifySteam, type Identity } from '@/lib/connect/identity';
import { linkVerifiedAccount } from '@/lib/connect/link';
import { getViewer } from '@/lib/data/community';
import { siteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

const COOKIE = 'connect_state';

function finish(code: string) {
  const response = NextResponse.redirect(new URL(`/profil/comptes?connexion=${code}`, siteUrl()));
  response.cookies.delete({ name: COOKIE, path: '/api/connect' });
  return response;
}

/** Retour du fournisseur : contrôle du jeton anti-CSRF, preuve d'identité, puis enregistrement du compte vérifié. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProviderId(provider)) return finish('jeu');
  const url = request.nextUrl;

  const [state, cookieProvider, game] = (request.cookies.get(COOKIE)?.value ?? '').split('|');
  if (!state || state !== url.searchParams.get('state') || cookieProvider !== provider || !PROVIDERS[provider].games.includes(game)) return finish('etat');
  if (url.searchParams.get('error')) return finish('refuse');

  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL('/connexion?next=/profil/comptes', siteUrl()));

  let identity: Identity | null = null;
  try {
    identity = provider === 'steam' ? await verifySteam(url, state, game) : await exchangeOAuth(provider, url.searchParams.get('code'));
  } catch {
    return finish('echec');
  }
  if (!identity) return finish('echec');

  let result;
  try {
    result = await linkVerifiedAccount({ profileId: viewer.id, gameSlug: game, ...identity });
  } catch {
    return finish('echec');
  }
  return finish(result.ok ? 'ok' : result.error);
}
