import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const LINKS: [string, string][] = [
  ['Accueil', '/'],
  ['Matchs', '/matchs'],
  ['Jeux', '/jeux'],
  ['Tournois', '/tournois'],
  ['Équipes', '/equipes'],
  ['Joueurs', '/joueurs'],
  ['Classements', '/classements'],
];

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const account = user ? (
    <Link href="/profil" className="hover:text-[var(--accent-blue)]">
      Mon profil
    </Link>
  ) : (
    <>
      <Link href="/connexion" className="hover:text-[var(--accent-blue)]">
        Connexion
      </Link>
      <Link href="/inscription" className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium">
        S’inscrire
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <nav aria-label="Navigation principale" className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/" className="text-lg font-bold tracking-wide">
          ESPORT <span className="text-[var(--accent)]">HUB</span>
        </Link>

        <ul className="hidden flex-1 items-center gap-5 text-sm text-zinc-300 md:flex">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <Link href={href} className="hover:text-white">
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-4 text-sm md:flex">{account}</div>

        <details className="relative ml-auto md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">Menu</summary>
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
            <ul className="space-y-2 text-sm">
              {LINKS.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="block rounded-md px-2 py-1.5 hover:bg-white/5">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-3 border-t border-[var(--border)] pt-3 text-sm">{account}</div>
          </div>
        </details>
      </nav>
    </header>
  );
}
