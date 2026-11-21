import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EmptyState, ErrorState, FilterTabs, Logo, PageHeader } from '@/components/ui';
import { fetchGames, fetchStandings } from '@/lib/data/catalog';
import { one } from '@/lib/params';

export const metadata: Metadata = { title: 'Classements' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ClassementsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { games, failed: gamesFailed } = await fetchGames();
  const game = games.find((g) => g.slug === one(sp.jeu)) ?? games[0];
  const standings = game ? await fetchStandings(game.id, 100) : { rows: [], failed: false };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Classements" subtitle="Classement des équipes par jeu, calculé à partir des matchs terminés enregistrés sur ESPORT HUB." />
      {gamesFailed ? (
        <ErrorState />
      ) : !game ? (
        <EmptyState>Aucun jeu n’est encore configuré.</EmptyState>
      ) : (
        <>
          <FilterTabs items={games.map((g) => ({ label: g.short_name ?? g.name, href: `/classements?jeu=${g.slug}`, active: g.slug === game.slug }))} />
          <h2 className="mb-4 mt-8 text-xl font-semibold">{game.name}</h2>
          {standings.failed ? (
            <ErrorState />
          ) : standings.rows.length === 0 ? (
            <EmptyState>Pas encore assez de matchs terminés pour établir un classement de {game.name}.</EmptyState>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-zinc-400">
                    <th className="px-4 py-3">#</th>
                    <th className="py-3">Équipe</th>
                    <th className="px-4 py-3 text-right">Joués</th>
                    <th className="px-4 py-3 text-right">V - D</th>
                    <th className="px-4 py-3 text-right">% victoires</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.rows.map((row, index) => (
                    <tr key={row.team.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-3 text-zinc-500">{index + 1}</td>
                      <td className="py-3">
                        <Link href={`/equipes/${row.team.slug}`} className="flex items-center gap-3 hover:text-[var(--accent-blue)]">
                          <Logo src={row.team.logo_url} name={row.team.name} size={28} />
                          {row.team.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.played}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.wins} - {row.losses}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{row.winRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
