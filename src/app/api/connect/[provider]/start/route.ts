import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { PROVIDERS, isConfigured, isProviderId } from '@/lib/connect/providers';
import { authorizeUrl, steamAuthorizeUrl } from '@/lib/connect/identity';
import { getViewer } from '@/lib/data/community';
import { siteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Début de la connexion d'un compte de jeu : redirige vers le fournisseur avec un jeton anti-CSRF (cookie). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const game = request.nextUrl.searchParams.get('game') ?? '';
  const back = (code: string) => NextResponse.redirect(new URL(`/profil/comptes?connexion=${code}`, siteUrl()));

  if (!isProviderId(provider)) return back('jeu');
  const def = PROVIDERS[provider];
  if (!def.games.includes(game)) return back('jeu');
  if (!isConfigured(def)) return back('non_configure');

  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL('/connexion?next=/profil/comptes', siteUrl()));

  const state = randomBytes(24).toString('hex');
  const response = NextResponse.redirect(provider === 'steam' ? steamAuthorizeUrl(state, game) : authorizeUrl(provider, state));
  response.cookies.set({
    name: 'connect_state',
    value: `${state}|${provider}|${game}`,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/connect',
    maxAge: 600,
  });
  return response;
}
