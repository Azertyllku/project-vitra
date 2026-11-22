export type EmbedProvider = 'twitch_channel' | 'twitch_video' | 'twitch_clip' | 'youtube_video' | 'hls';

/** Mêmes règles que les contraintes SQL : défense en profondeur contre toute référence malformée. */
const RULES: Record<EmbedProvider, RegExp> = {
  twitch_channel: /^[A-Za-z0-9_]{3,25}$/,
  twitch_video: /^[0-9]{5,15}$/,
  twitch_clip: /^[A-Za-z0-9_-]{5,100}$/,
  youtube_video: /^[A-Za-z0-9_-]{11}$/,
  hls: /^https:\/\/[^\s"'<>]+$/,
};

export const isValidRef = (provider: EmbedProvider, ref: string): boolean => RULES[provider]?.test(ref) ?? false;

function twitchTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m}m${Math.floor(seconds % 60)}s`;
}

/** URL d'intégration officielle du fournisseur (HLS : lecteur dédié, pas d'iframe). */
export function buildEmbedUrl(provider: EmbedProvider, ref: string, opts: { parent: string; start?: number }): string | null {
  if (!isValidRef(provider, ref)) return null;
  const start = opts.start && opts.start > 0 ? Math.floor(opts.start) : 0;
  const parent = encodeURIComponent(opts.parent);
  switch (provider) {
    case 'twitch_channel':
      return `https://player.twitch.tv/?channel=${ref}&parent=${parent}&autoplay=false`;
    case 'twitch_video':
      return `https://player.twitch.tv/?video=v${ref}&parent=${parent}&autoplay=false${start ? `&time=${twitchTime(start)}` : ''}`;
    case 'twitch_clip':
      return `https://clips.twitch.tv/embed?clip=${ref}&parent=${parent}&autoplay=false`;
    case 'youtube_video':
      return `https://www.youtube-nocookie.com/embed/${ref}?rel=0${start ? `&start=${start}` : ''}`;
    default:
      return null;
  }
}
