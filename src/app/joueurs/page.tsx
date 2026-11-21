import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Pager } from '@/components/ui';
import type { PlayerLite } from '@/lib/data/types';
import { flag } from '@/lib/format';
import { cleanSearch, pageNumber } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Joueurs' };

const PAGE_SIZE = 24;
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function JoueursPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const page = pageNumber(sp.page);

  const supabase = await createClient();
  let query = supabase
    .from('players')
    .select('id, slug, nickname, real_name, country_code, photo_url, is_professional')
    .eq('is_active', true)
    .order('nickname');
  if (q) query = query.ilike('nickname', `%${q}%`);
  const { data, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE).returns<PlayerLite[]>();
  const rows = data ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader title="Joueurs" subtitle="Joueurs professionnels et amateurs." />
      <form action="/joueurs" className="mb-8 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Rechercher un joueur…" aria-label="Rechercher un joueur" className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--accent)]" />
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium">Rechercher</button>
      </form>
      {error ? (
        <ErrorState />
      ) : rows.length === 0 ? (
        <EmptyState>{q ? 'Aucun joueur ne correspond à votre recherche.' : 'Aucun joueur n’est encore enregistré.'}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.slice(0, PAGE_SIZE).map((player) => (
            <li key={player.id}>
              <Link href={`/joueurs/${player.slug}`}>
                <Card className="flex items-center justify-between gap-3 p-4 transition hover:border-[var(--accent)]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{flag(player.country_code)} {player.nickname}</span>
                    {player.real_name && <span className="text-xs text-zinc-400">{player.real_name}</span>}
                  </span>
                  <Badge tone={player.is_professional ? 'violet' : 'neutral'}>{player.is_professional ? 'Pro' : 'Amateur'}</Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager basePath="/joueurs" params={q ? { q } : {}} page={page} hasNext={rows.length > PAGE_SIZE} />
    </main>
  );
}
