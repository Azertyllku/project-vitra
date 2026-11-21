import Link from 'next/link';
import { LiveRefresh } from '@/components/live-refresh';
import { MatchGrid } from '@/components/match-card';
import { Card, EmptyState, ErrorState, SectionTitle } from '@/components/ui';
import { fetchGames } from '@/lib/data/catalog';
import { fetchMatches } from '@/lib/data/matches';

export default async function HomePage() {
  const [live, upcoming, results, { games, failed: gamesFailed }] = await Promise.all([
    fetchMatches({ status: 'live', limit: 6 }),
    fetchMatches({ status: 'scheduled', limit: 6, ascending: true }),
    fetchMatches({ status: 'finished', limit: 6 }),
    fetchGames(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <LiveRefresh />
      <section className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-violet-900/40 via-[var(--surface)] to-blue-900/30 p-8 md:p-12">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Tout l’esport, au même endroit.</h1>
        <p className="mt-3 max-w-2xl text-zinc-300">Matchs, tournois, équipes et joueurs de vos jeux compétitifs préférés.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/matchs" className="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium hover:brightness-110">
            Voir les matchs
          </Link>
          <Link href="/tournois" className="rounded-lg border border-[var(--border)] px-5 py-2.5 hover:bg-white/5">
            Tournois
          </Link>
        </div>
      </section>

      <SectionTitle href="/matchs?statut=live">En direct</SectionTitle>
      {live.failed ? <ErrorState /> : live.matches.length === 0 ? <EmptyState>Aucun match en direct pour le moment.</EmptyState> : <MatchGrid matches={live.matches} />}

      <SectionTitle href="/matchs?statut=a-venir">Prochains matchs</SectionTitle>
      {upcoming.failed ? <ErrorState /> : upcoming.matches.length === 0 ? <EmptyState>Aucun match programmé pour le moment.</EmptyState> : <MatchGrid matches={upcoming.matches} />}

      <SectionTitle href="/matchs?statut=termines">Derniers résultats</SectionTitle>
      {results.failed ? <ErrorState /> : results.matches.length === 0 ? <EmptyState>Aucun résultat enregistré pour le moment.</EmptyState> : <MatchGrid matches={results.matches} />}

      <SectionTitle href="/jeux">Jeux</SectionTitle>
      {gamesFailed ? (
        <ErrorState />
      ) : games.length === 0 ? (
        <EmptyState>Aucun jeu n’est encore configuré.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <li key={game.id}>
              <Link href={`/jeux/${game.slug}`}>
                <Card className="flex items-center gap-3 p-4 transition hover:border-[var(--accent)]">
                  <span className="h-8 w-1.5 rounded-full" style={{ background: game.accent_color ?? 'var(--accent)' }} />
                  <span>
                    <span className="block font-medium">{game.name}</span>
                    {game.genre && <span className="text-xs text-zinc-400">{game.genre}</span>}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
