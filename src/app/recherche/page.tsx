import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchBox } from '@/components/search-box';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { one } from '@/lib/params';
import { cleanQuery, searchAll, type HitType } from '@/lib/search';

export const metadata: Metadata = { title: 'Recherche', robots: { index: false } };

const ORDER: HitType[] = ['Joueur', 'Équipe', 'Jeu', 'Tournoi', 'Article', 'Rediffusion', 'Communauté'];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RecherchePage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = cleanQuery(one(sp.q) ?? '');
  const hits = q.length >= 2 ? await searchAll(q, 10) : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader title="Recherche" subtitle="Joueurs, équipes, jeux, tournois, articles, rediffusions et communautés." />
      <SearchBox defaultValue={q} />

      <div className="mt-8">
        {q.length < 2 ? (
          <EmptyState>Saisissez au moins 2 caractères.</EmptyState>
        ) : hits.length === 0 ? (
          <EmptyState>Aucun résultat pour « {q} ».</EmptyState>
        ) : (
          ORDER.map((type) => {
            const group = hits.filter((hit) => hit.type === type);
            if (group.length === 0) return null;
            return (
              <section key={type}>
                <SectionTitle>{type}{group.length > 1 && type !== 'Jeu' ? 's' : ''}</SectionTitle>
                <ul className="space-y-2">
                  {group.map((hit) => (
                    <li key={hit.href}>
                      <Link href={hit.href}>
                        <Card className="flex items-center justify-between gap-3 px-4 py-3 transition hover:border-[var(--accent)]">
                          <span className="truncate">{hit.label}</span>
                          {hit.sub && <span className="shrink-0 text-xs text-zinc-500">{hit.sub}</span>}
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
