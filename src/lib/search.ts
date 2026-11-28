import { createClient } from '@/lib/supabase/server';

export type HitType = 'Joueur' | 'Équipe' | 'Jeu' | 'Tournoi' | 'Article' | 'Rediffusion' | 'Communauté';

export interface SearchHit {
  type: HitType;
  label: string;
  sub: string | null;
  href: string;
}

/** Retire les caractères qui auraient un sens dans un motif de recherche (jokers, séparateurs, guillemets). */
export const cleanQuery = (raw: string) => raw.replace(/[%_,()*\\"'`;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

/** Recherche globale sur les contenus publics, avec les droits de l'appelant (la RLS filtre). */
export async function searchAll(raw: string, perType = 5): Promise<SearchHit[]> {
  const q = cleanQuery(raw);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const now = new Date().toISOString();
  const supabase = await createClient();

  const [players, teams, games, tournaments, articles, vods, communities] = await Promise.all([
    supabase.from('players').select('slug, nickname').eq('is_active', true).ilike('nickname', like).limit(perType).returns<{ slug: string; nickname: string }[]>(),
    supabase.from('teams').select('slug, name, tag').eq('is_active', true).ilike('name', like).limit(perType).returns<{ slug: string; name: string; tag: string | null }[]>(),
    supabase.from('games').select('slug, name, genre').eq('is_active', true).ilike('name', like).limit(perType).returns<{ slug: string; name: string; genre: string | null }[]>(),
    supabase.from('tournaments').select('slug, name, game:games(name)').ilike('name', like).limit(perType).returns<{ slug: string; name: string; game: { name: string } | null }[]>(),
    supabase.from('articles').select('slug, title').eq('status', 'published').lte('published_at', now).ilike('title', like).limit(perType).returns<{ slug: string; title: string }[]>(),
    supabase.from('vods').select('id, title').eq('rights_status', 'authorized').ilike('title', like).limit(perType).returns<{ id: string; title: string }[]>(),
    supabase.from('communities').select('slug, name').ilike('name', like).limit(perType).returns<{ slug: string; name: string }[]>(),
  ]);

  return [
    ...(players.data ?? []).map((r): SearchHit => ({ type: 'Joueur', label: r.nickname, sub: null, href: `/joueurs/${r.slug}` })),
    ...(teams.data ?? []).map((r): SearchHit => ({ type: 'Équipe', label: r.name, sub: r.tag, href: `/equipes/${r.slug}` })),
    ...(games.data ?? []).map((r): SearchHit => ({ type: 'Jeu', label: r.name, sub: r.genre, href: `/jeux/${r.slug}` })),
    ...(tournaments.data ?? []).map((r): SearchHit => ({ type: 'Tournoi', label: r.name, sub: r.game?.name ?? null, href: `/tournois/${r.slug}` })),
    ...(articles.data ?? []).map((r): SearchHit => ({ type: 'Article', label: r.title, sub: null, href: `/actualites/${r.slug}` })),
    ...(vods.data ?? []).map((r): SearchHit => ({ type: 'Rediffusion', label: r.title, sub: null, href: `/rediffusions/${r.id}` })),
    ...(communities.data ?? []).map((r): SearchHit => ({ type: 'Communauté', label: r.name, sub: null, href: `/communaute/${r.slug}` })),
  ];
}
