import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type PostKind = 'text' | 'clip' | 'performance';

export interface PostRow {
  id: string;
  author_id: string;
  kind: PostKind;
  body: string;
  clip_provider: 'youtube_video' | 'twitch_clip' | null;
  clip_ref: string | null;
  account_id: string | null;
  period: string | null;
  created_at: string;
  is_hidden: boolean;
  author: { username: string; display_name: string | null } | null;
  community: { slug: string; name: string } | null;
}

export interface Viewer {
  id: string;
  isStaff: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

export const POST_SELECT =
  'id, author_id, kind, body, clip_provider, clip_ref, account_id, period, created_at, is_hidden, author:profiles(username, display_name), community:communities(slug, name)';

/**
 * Utilisateur connecté + indicateur staff (rôles lus avec la RLS : chacun ne voit que les siens).
 * Mémorisé par requête : l'en-tête et la page partagent le même résultat (un seul aller-retour).
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).returns<{ role: string }[]>();
  return { id: user.id, isStaff: (data ?? []).some((r) => ['editor', 'admin', 'super_admin'].includes(r.role)) };
});

export interface PostQuery {
  communityId?: string;
  authorId?: string;
  /** Filtre PostgREST `or` (ex. "author_id.in.(a,b),community_id.in.(c)"). */
  or?: string;
  limit?: number;
  offset?: number;
}

export async function fetchPosts(opts: PostQuery = {}): Promise<{ posts: PostRow[]; hasMore: boolean; failed: boolean }> {
  const supabase = await createClient();
  const limit = opts.limit ?? 15;
  const offset = opts.offset ?? 0;
  let query = supabase.from('posts').select(POST_SELECT).eq('is_hidden', false).order('created_at', { ascending: false });
  if (opts.communityId) query = query.eq('community_id', opts.communityId);
  if (opts.authorId) query = query.eq('author_id', opts.authorId);
  if (opts.or) query = query.or(opts.or);
  const { data, error } = await query.range(offset, offset + limit).returns<PostRow[]>();
  const rows = data ?? [];
  return { posts: rows.slice(0, limit), hasMore: rows.length > limit, failed: Boolean(error) };
}

export async function fetchPost(id: string): Promise<PostRow | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('posts').select(POST_SELECT).eq('id', id).maybeSingle<PostRow>();
  return data;
}

export interface ReactionData {
  counts: Record<string, Record<string, number>>;
  mine: Record<string, string>;
}

export async function fetchReactionData(type: 'post' | 'comment', ids: string[], viewerId: string | null): Promise<ReactionData> {
  const empty: ReactionData = { counts: {}, mine: {} };
  if (ids.length === 0) return empty;
  const supabase = await createClient();
  const [counts, mine] = await Promise.all([
    supabase.rpc('reaction_counts', { _type: type, _ids: ids }),
    viewerId
      ? supabase.from('reactions').select('target_id, kind').eq('user_id', viewerId).eq('target_type', type).in('target_id', ids)
      : Promise.resolve({ data: [] as { target_id: string; kind: string }[] }),
  ]);
  for (const row of (counts.data ?? []) as { target_id: string; kind: string; n: number | string }[]) {
    (empty.counts[row.target_id] ??= {})[row.kind] = Number(row.n);
  }
  for (const row of (mine.data ?? []) as { target_id: string; kind: string }[]) empty.mine[row.target_id] = row.kind;
  return empty;
}

export interface CommentRow {
  id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author: { username: string } | null;
}

export async function fetchComments(postId: string): Promise<CommentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('comments')
    .select('id, author_id, parent_id, body, created_at, author:profiles(username)')
    .eq('post_id', postId)
    .eq('is_hidden', false)
    .order('created_at')
    .limit(300)
    .returns<CommentRow[]>();
  return data ?? [];
}
