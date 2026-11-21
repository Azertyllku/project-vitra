import { createClient } from '@/lib/supabase/server';
import type { EmbedProvider } from '@/lib/embed';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VodKind = 'full' | 'highlight' | 'best_play' | 'summary';
export const KIND_LABEL: Record<VodKind, string> = {
  full: 'Match complet',
  highlight: 'Highlights',
  best_play: 'Meilleures actions',
  summary: 'Résumé',
};
export const KINDS = Object.keys(KIND_LABEL) as VodKind[];

/* ---------- Diffusions en direct ---------- */

export interface StreamSource {
  id: string;
  provider: EmbedProvider;
  embed_ref: string;
  language: string;
  label: string | null;
  is_official: boolean;
  rights_holder: string | null;
  sort_order: number;
}

export interface StreamRow {
  id: string;
  title: string;
  status: 'scheduled' | 'live' | 'ended';
  starts_at: string | null;
  match_id: string | null;
  game: { slug: string; name: string } | null;
  tournament: { slug: string; name: string } | null;
  sources: StreamSource[];
}

const STREAM_SELECT =
  'id, title, status, starts_at, match_id, game:games(slug, name), tournament:tournaments(slug, name), sources:stream_sources(id, provider, embed_ref, language, label, is_official, rights_holder, sort_order)';

/** Les sources renvoyées sont déjà filtrées par la RLS : seules les sources aux droits validés sont lisibles. */
function sortSources(stream: StreamRow): StreamRow {
  const sources = [...(stream.sources ?? [])].sort(
    (a, b) => Number(b.language === 'fr') - Number(a.language === 'fr') || Number(b.is_official) - Number(a.is_official) || a.sort_order - b.sort_order,
  );
  return { ...stream, sources };
}

export async function fetchStreams(status: 'live' | 'scheduled', limit = 12): Promise<{ streams: StreamRow[]; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('streams')
    .select(STREAM_SELECT)
    .eq('status', status)
    .order('starts_at', { ascending: status === 'scheduled', nullsFirst: false })
    .limit(limit)
    .returns<StreamRow[]>();
  return { streams: (data ?? []).map(sortSources), failed: Boolean(error) };
}

export async function fetchStream(id: string): Promise<StreamRow | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('streams').select(STREAM_SELECT).eq('id', id).maybeSingle<StreamRow>();
  return data ? sortSources(data) : null;
}

/* ---------- Rediffusions ---------- */

export interface VodCardRow {
  id: string;
  title: string;
  kind: VodKind;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  published_at: string;
  language: string;
  game: { slug: string; name: string } | null;
}

export interface VodQuery {
  gameSlug?: string;
  kind?: VodKind;
  q?: string;
  sort?: 'recent' | 'populaires';
  duration?: 'court' | 'moyen' | 'long';
  matchId?: string;
  excludeId?: string;
  limit?: number;
  offset?: number;
}

export async function fetchVods(opts: VodQuery = {}): Promise<{ vods: VodCardRow[]; hasMore: boolean; failed: boolean }> {
  const supabase = await createClient();
  const limit = opts.limit ?? 18;
  const offset = opts.offset ?? 0;
  const game = opts.gameSlug ? 'game:games!inner(slug, name)' : 'game:games(slug, name)';

  let query = supabase.from('vods').select(`id, title, kind, duration_seconds, thumbnail_url, published_at, language, ${game}`);
  if (opts.gameSlug) query = query.eq('game.slug', opts.gameSlug);
  if (opts.kind) query = query.eq('kind', opts.kind);
  if (opts.matchId) query = query.eq('match_id', opts.matchId);
  if (opts.excludeId) query = query.neq('id', opts.excludeId);
  if (opts.q) query = query.ilike('title', `%${opts.q}%`);
  if (opts.duration === 'court') query = query.lt('duration_seconds', 600);
  if (opts.duration === 'moyen') query = query.gte('duration_seconds', 600).lte('duration_seconds', 2700);
  if (opts.duration === 'long') query = query.gt('duration_seconds', 2700);

  query =
    opts.sort === 'populaires'
      ? query.order('viewer_count', { ascending: false }).order('published_at', { ascending: false })
      : query.order('published_at', { ascending: false });

  const { data, error } = await query.range(offset, offset + limit).returns<VodCardRow[]>();
  const rows = data ?? [];
  return { vods: rows.slice(0, limit), hasMore: rows.length > limit, failed: Boolean(error) };
}

export interface VodDetail extends VodCardRow {
  game_id: string;
  match_id: string | null;
  description: string | null;
  provider: 'twitch_video' | 'youtube_video' | 'hls';
  embed_ref: string;
  rights_holder: string | null;
  tournament: { slug: string; name: string } | null;
  chapters: { id: string; title: string; start_seconds: number; sort_order: number }[];
}

export async function fetchVod(id: string): Promise<VodDetail | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('vods')
    .select(
      'id, game_id, match_id, title, description, kind, provider, embed_ref, language, duration_seconds, thumbnail_url, published_at, rights_holder, game:games(slug, name), tournament:tournaments(slug, name), chapters:vod_chapters(id, title, start_seconds, sort_order)',
    )
    .eq('id', id)
    .maybeSingle<VodDetail>();
  if (!data) return null;
  return { ...data, chapters: [...(data.chapters ?? [])].sort((a, b) => a.start_seconds - b.start_seconds) };
}
