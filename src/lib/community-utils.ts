/** Message d'erreur lisible pour une erreur Supabase/Postgres (anti-spam, sourdine, RLS). */
export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message ?? '';
  if (message.includes('rate_limit_exceeded')) return 'Trop d’actions en peu de temps. Réessayez dans un instant.';
  if (message.includes('too_many_links')) return 'Trop de liens dans ce message.';
  if (error?.code === '23505') return 'Action déjà effectuée.';
  if (error?.code === '42501' || message.includes('row-level security')) {
    return 'Action refusée : vérifiez que vous êtes membre de cette communauté (votre compte peut aussi être en sourdine).';
  }
  return 'Action impossible, réessayez.';
}

/** Extrait un clip YouTube ou Twitch d'une URL. Retourne null si l'URL n'est pas reconnue. */
export function parseClip(raw: string): { provider: 'youtube_video' | 'twitch_clip'; ref: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  let youtube: string | null = null;
  if (host === 'youtu.be') youtube = parts[0] ?? null;
  else if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') youtube = url.searchParams.get('v');
    else if (parts[0] === 'shorts') youtube = parts[1] ?? null;
  }
  if (youtube && /^[A-Za-z0-9_-]{11}$/.test(youtube)) return { provider: 'youtube_video', ref: youtube };

  let twitch: string | null = null;
  if (host === 'clips.twitch.tv') twitch = parts[0] ?? null;
  else if (host === 'twitch.tv' || host === 'm.twitch.tv') {
    const index = parts.indexOf('clip');
    if (index >= 0) twitch = parts[index + 1] ?? null;
  }
  if (twitch && /^[A-Za-z0-9_-]{5,100}$/.test(twitch)) return { provider: 'twitch_clip', ref: twitch };
  return null;
}
