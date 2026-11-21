import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { fetchGames } from '@/lib/data/catalog';

export const metadata: Metadata = { title: 'Jeux' };

export default async function JeuxPage() {
  const { games, failed } = await fetchGames();
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader title="Jeux" subtitle="Choisissez un jeu pour voir ses matchs, tournois et classements." />
      {failed ? (
        <ErrorState />
      ) : games.length === 0 ? (
        <EmptyState>Aucun jeu n’est encore configuré.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <li key={game.id}>
              <Link href={`/jeux/${game.slug}`}>
                <Card className="overflow-hidden transition hover:border-[var(--accent)]">
                  <div className="h-2" style={{ background: game.accent_color ?? 'var(--accent)' }} />
                  <div className="p-5">
                    <p className="text-lg font-semibold">{game.name}</p>
                    {game.genre && <p className="text-sm text-zinc-400">{game.genre}</p>}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
