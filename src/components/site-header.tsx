import Link from 'next/link';
import { NotificationBell } from '@/components/notification-bell';
import { getViewer } from '@/lib/data/community';
import { createClient } from '@/lib/supabase/server';

const LINKS: [string, string][] = [
  ['Accueil', '/'],
  ['Live', '/live'],
  ['Matchs', '/matchs'],
  ['Rediffusions', '/rediffusions'],
  ['Jeux', '/jeux'],
  ['Tournois', '/tournois'],
  ['Équipes', '/equipes'],
  ['Joueurs', '/joueurs'],
  ['Classements', '/classements'],
  ['Communauté', '/communaute'],
  ['Premium', '/premium'],
];

export async function SiteHeader() {
  const viewer = await getViewer();
  let unread = 0;
  if (viewer) {
    const supabase = await createClient();
    const { count } = await supabase.from('user_notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    unread = count ?? 0;
  }

  const account = viewer ? (
    <>
      <NotificationBell userId={viewer.id} initialCount={unread} />
      <Link href="/messages" className="hover:text-[var(--accent-blue)]">Messages</Link>
      {viewer.isStaff && <Link href="/moderation" className="hover:text-[var(--accent-blue)]">Modération</Link>}
      <Link href="/profil" className="hover:text-[var(--accent-blue)]">Mon profil</Link>
    </>
  ) : (
    <>
      <Link href="/connexion" className="hover:text-[var(--accent-blue)]">Connexion</Link>
      <Link href="/inscription" className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium">S’inscrire</Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <nav aria-label="Navigation principale" className="mx-auto flex max-w-7xl items-center gap-5 px-6 py-3">
        <Link href="/" className="text-lg font-bold tracking-wide">
          ESPORT <span className="text-[var(--accent)]">HUB</span>
        </Link>

        <ul className="hidden flex-1 items-center gap-4 text-sm text-zinc-300 xl:flex">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <Link href={href} className="hover:text-white">
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-4 text-sm xl:flex">{account}</div>

        <details className="relative ml-auto xl:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">Menu</summary>
          <div className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
            <ul className="space-y-2 text-sm">
              {LINKS.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="block rounded-md px-2 py-1.5 hover:bg-white/5">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3 text-sm">{account}</div>
          </div>
        </details>
      </nav>
    </header>
  );
}
