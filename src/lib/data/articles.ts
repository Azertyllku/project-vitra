import { createClient } from '@/lib/supabase/server';

export const ARTICLE_CATEGORIES: Record<string, string> = {
  actualite: 'Actualité',
  resultats: 'Résultats',
  transferts: 'Transferts',
  analyse: 'Analyse',
  interview: 'Interview',
  communique: 'Communiqué',
};

export interface ArticleCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  category: string;
  published_at: string;
  game: { name: string; slug: string } | null;
}

export interface ArticleFull extends ArticleCard {
  body: string;
  updated_at: string;
  source_name: string | null;
  source_url: string | null;
}

const CARD = 'id, slug, title, excerpt, cover_url, category, published_at, game:games(name, slug)';

/** Articles publiés uniquement (même pour le staff, qui voit les brouillons dans l'administration). */
export async function fetchArticles(opts: { category?: string; limit?: number; offset?: number } = {}): Promise<{ articles: ArticleCard[]; hasMore: boolean; failed: boolean }> {
  const supabase = await createClient();
  const limit = opts.limit ?? 12;
  const offset = opts.offset ?? 0;
  let query = supabase.from('articles').select(CARD).eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false });
  if (opts.category && ARTICLE_CATEGORIES[opts.category]) query = query.eq('category', opts.category);
  const { data, error } = await query.range(offset, offset + limit).returns<ArticleCard[]>();
  const rows = data ?? [];
  return { articles: rows.slice(0, limit), hasMore: rows.length > limit, failed: Boolean(error) };
}

export async function fetchArticle(slug: string): Promise<ArticleFull | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('articles')
    .select(`${CARD}, body, updated_at, source_name, source_url`)
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle<ArticleFull>();
  return data;
}
