import type { Metadata } from 'next';
import { LiveRefresh } from '@/components/live-refresh';
import { MatchGrid } from '@/components/match-card';
import { EmptyState, ErrorState, FilterTabs, PageHeader, Pager } from '@/components/ui';
import { fetchGames } from '@/lib/data/catalog';
import { fetchMatches } from '@/lib/data/matches';
import type { MatchStatus } from '@/lib/data/types';
import { one, pageNumber } from '@/lib/params';

export const metadata: Metadata = { title: 'Matchs' };

const PAGE_SIZE = 18;
const TABS: { key: string; label: string; status: MatchStatus; ascending: boolean; empty: string }[] = [
  { key: 'live', label: 'En direct', status: 'live', ascending: false, empty: 'Aucun match en direct pour le moment.' },
  { key: 'a-venir', label: 'À venir', status: 'scheduled', ascending: true, empty: 'Aucun match programmé.' },
  { key: 'termines', label: 'Terminés', status: 'finished', ascending: false, empty: 'Aucun résultat enregistré.' },
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function MatchsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === one(sp.statut)) ?? TABS[1];
  const gameSlug = one(sp.jeu);
  const page = pageNumber(sp.page);

  const [{ games }, { matches, hasMore, failed }] = await Promise.all([
    fetchGames(),
    fetchMatches({ status: tab.status, gameSlug, ascending: tab.ascending, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  ]);

  const link = (statut: string, jeu?: string) => {
    const params = new URLSearchParams({ statut });
    if (jeu) params.set('jeu', jeu);
    return `/matchs?${params.toString()}`;
  };
  const params: Record<string, string> = { statut: tab.key };
  if (gameSlug) params.jeu = gameSlug;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {tab.key === 'live' && <LiveRefresh />}
      <PageHeader title="Matchs" subtitle="Calendrier, scores en direct et résultats." />
      <div className="space-y-4">
        <FilterTabs items={TABS.map((t) => ({ label: t.label, href: link(t.key, gameSlug), active: t.key === tab.key }))} />
        <FilterTabs
          items={[
            { label: 'Tous les jeux', href: link(tab.key), active: !gameSlug },
            ...games.map((g) => ({ label: g.short_name ?? g.name, href: link(tab.key, g.slug), active: g.slug === gameSlug })),
          ]}
        />
      </div>
      <div className="mt-8">
        {failed ? <ErrorState /> : matches.length === 0 ? <EmptyState>{tab.empty}</EmptyState> : <MatchGrid matches={matches} />}
      </div>
      <Pager basePath="/matchs" params={params} page={page} hasNext={hasMore} />
    </main>
  );
}
