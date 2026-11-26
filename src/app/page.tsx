import Link from 'next/link';
import { LiveRefresh } from '@/components/live-refresh';
import { MatchGrid } from '@/components/match-card';
import { Card, EmptyState, ErrorState, SectionTitle } from '@/components/ui';
import { fetchGames } from '@/lib/data/catalog';
import { getViewer } from '@/lib/data/community';
import { fetchMatches } from '@/lib/data/matches';

const SHORTCUTS = [
  { href: '/matchs', title: 'Matchs', text: 'Scores, programme et direct' },
  { href: '/tournois', title: 'Tournois', text: 'Compétitions et classements' },
  { href: '/classements', title: 'Classements', text: 'Équipes et joueurs par jeu' },
  { href: '/communaute', title: 'Communauté', text: 'Publications, clips et discussions' },
];

export default async function HomePage() {
  const [viewer, live, upcoming, results, { games, failed: gamesFailed }] = await Promise.all([
    getViewer(),
    fetchMatches({ status: 'live', limit: 6 }),
    fetchMatches({ status: 'scheduled', limit: 6, ascending: true }),
    fetchMatches({ status: 'finished', limit: 6 }),
    fetchGames(),
  ]);

  const matchesFailed = live.failed || upcoming.failed || results.failed;
  const noMatches = !matchesFailed && live.matches.length + upcoming.matches.length + results.matches.length === 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:py-10">
      <LiveRefresh />

      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 md:px-12 md:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent-blue)]">Plateforme esport multi-jeux</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">Tout l’esport, au même endroit.</h1>
          <p className="mt-4 text-zinc-300">Suivez les matchs et les tournois, découvrez les équipes et analysez vos propres performances.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/matchs" className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium hover:brightness-110">
              Voir les matchs
            </Link>
            <Link href="/tournois" className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm hover:bg-white/5">
              Tournois
            </Link>
            <Link href={viewer ? '/profil/performances' : '/inscription'} className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:text-white">
              {viewer ? 'Mes performances →' : 'Créer un compte →'}
            </Link>
          </div>
        </div>
      </section>

      <nav aria-label="Accès rapide" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="p-4 transition hover:border-[var(--accent)]">
              <span className="block font-medium">{item.title}</span>
              <span className="mt-0.5 block text-xs text-zinc-400">{item.text}</span>
            </Card>
          </Link>
        ))}
      </nav>

      {matchesFailed && (
        <div className="mt-10">
          <ErrorState />
        </div>
      )}
      {noMatches && (
        <div className="mt-10">
          <EmptyState>Aucun match pour le moment : les rencontres apparaîtront ici dès qu’elles seront programmées.</EmptyState>
        </div>
      )}
      {live.matches.length > 0 && (
        <>
          <SectionTitle href="/matchs?statut=live">En direct</SectionTitle>
          <MatchGrid matches={live.matches} />
        </>
      )}
      {upcoming.matches.length > 0 && (
        <>
          <SectionTitle href="/matchs?statut=a-venir">Prochains matchs</SectionTitle>
          <MatchGrid matches={upcoming.matches} />
        </>
      )}
      {results.matches.length > 0 && (
        <>
          <SectionTitle href="/matchs?statut=termines">Derniers résultats</SectionTitle>
          <MatchGrid matches={results.matches} />
        </>
      )}

      <SectionTitle href="/jeux">Jeux</SectionTitle>
      {gamesFailed ? (
        <ErrorState />
      ) : games.length === 0 ? (
        <EmptyState>Aucun jeu n’est encore configuré.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {games.map((game) => (
            <li key={game.id}>
              <Link href={`/jeux/${game.slug}`}>
                <Card className="flex items-center gap-3 p-4 transition hover:border-[var(--accent)]">
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: game.accent_color ?? 'var(--accent)' }} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{game.name}</span>
                    {game.genre && <span className="block truncate text-xs text-zinc-400">{game.genre}</span>}
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
