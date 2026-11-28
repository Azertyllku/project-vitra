import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';
import { publicClient } from '@/lib/supabase/public';

export const revalidate = 3600;

const STATIC_PATHS = ['', '/matchs', '/tournois', '/equipes', '/joueurs', '/jeux', '/classements', '/live', '/rediffusions', '/communaute', '/actualites', '/confidentialite'];

type SlugRow = { slug: string; updated_at?: string };

/** Plan du site : pages publiques + fiches (jeux, équipes, joueurs, tournois, articles publiés). 1000 entrées par type au maximum. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl().replace(/\/$/, '');
  const client = publicClient();
  const slugs = async (table: string, extra = ''): Promise<SlugRow[]> => {
    const { data } = await client.from(table).select(`slug${extra}`).limit(1000).returns<SlugRow[]>();
    return data ?? [];
  };
  const [games, teams, players, tournaments, articles] = await Promise.all([
    slugs('games'),
    slugs('teams'),
    slugs('players'),
    slugs('tournaments'),
    slugs('articles', ', updated_at'),
  ]);

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: `${base}${path}`, changeFrequency: 'daily', priority: path === '' ? 1 : 0.7 }));
  const add = (prefix: string, rows: SlugRow[], priority: number) =>
    rows.forEach((row) => entries.push({ url: `${base}${prefix}/${row.slug}`, lastModified: row.updated_at, changeFrequency: 'weekly', priority }));
  add('/jeux', games, 0.6);
  add('/equipes', teams, 0.6);
  add('/joueurs', players, 0.5);
  add('/tournois', tournaments, 0.6);
  add('/actualites', articles, 0.8);
  return entries;
}
