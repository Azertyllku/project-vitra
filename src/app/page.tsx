import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface GameRow {
  id: string;
  slug: string;
  name: string;
  genre: string | null;
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('games')
    .select('id, slug, name, genre')
    .eq('is_active', true)
    .order('sort_order')
    .returns<GameRow[]>();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="mb-2 text-4xl font-bold">Bienvenue sur ESPORT HUB</h1>
      <p className="mb-10 text-zinc-400">Matchs, tournois, équipes et performances — au même endroit.</p>

      <h2 className="mb-4 text-xl font-semibold">Jeux</h2>
      {error ? (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
          Connexion à la base de données impossible pour le moment.
        </p>
      ) : !data || data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-zinc-400">
          Aucun jeu n'est encore configuré. Ils seront ajoutés depuis le panneau d'administration.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((game) => (
            <li key={game.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="font-semibold">{game.name}</p>
              {game.genre && <p className="text-sm text-zinc-400">{game.genre}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
