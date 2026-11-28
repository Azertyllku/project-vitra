import Link from 'next/link';
import { MobileMenu, NavDropdown, NavLink, type NavGroup } from '@/components/nav-links';
import { NotificationBell } from '@/components/notification-bell';
import { getViewer } from '@/lib/data/community';
import { createClient } from '@/lib/supabase/server';

const COMPETITIONS: NavGroup = {
  label: 'Compétitions',
  items: [
    { label: 'Tournois', href: '/tournois' },
    { label: 'Classements', href: '/classements' },
    { label: 'Jeux', href: '/jeux' },
  ],
};
const TEAMS_AND_PLAYERS: NavGroup = {
  label: 'Équipes et joueurs',
  items: [
    { label: 'Équipes', href: '/equipes' },
    { label: 'Joueurs', href: '/joueurs' },
  ],
};
const MEDIA: NavGroup = {
  label: 'Médias',
  items: [
    { label: 'Actualités', href: '/actualites' },
    { label: 'Rediffusions', href: '/rediffusions' },
  ],
};
const STAFF: NavGroup = {
  label: 'Staff',
  items: [
    { label: 'Modération', href: '/moderation' },
    { label: 'Administration', href: '/admin' },
  ],
};

export async function SiteHeader() {
  const supabase = await createClient();
  // Les deux requêtes partent en parallèle ; la RLS ne renvoie que les notifications du membre connecté.
  const [viewer, unreadRes] = await Promise.all([
    getViewer(),
    supabase.from('user_notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  const unread = viewer ? (unreadRes.count ?? 0) : 0;

  const mobileSections = [
    {
      items: [
        { label: 'Accueil', href: '/' },
        { label: 'Recherche', href: '/recherche' },
        { label: 'Live', href: '/live' },
        { label: 'Matchs', href: '/matchs' },
        { label: 'Communauté', href: '/communaute' },
      ],
    },
    { title: COMPETITIONS.label, items: COMPETITIONS.items },
    { title: TEAMS_AND_PLAYERS.label, items: TEAMS_AND_PLAYERS.items },
    { title: MEDIA.label, items: MEDIA.items },
  ];
  const mobileAccount = viewer
    ? [
        { label: 'Messages', href: '/messages' },
        ...(viewer.isStaff ? STAFF.items : []),
        { label: 'Mon profil', href: '/profil' },
      ]
    : [
        { label: 'Connexion', href: '/connexion' },
        { label: 'S’inscrire', href: '/inscription', primary: true },
      ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <nav aria-label="Navigation principale" className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        <Link href="/" className="shrink-0 whitespace-nowrap text-lg font-bold tracking-wide">
          ESPORT <span className="text-[var(--accent)]">HUB</span>
        </Link>

        <div className="hidden flex-1 items-center gap-1 xl:flex">
          <NavLink href="/live">Live</NavLink>
          <NavLink href="/matchs">Matchs</NavLink>
          <NavDropdown group={COMPETITIONS} />
          <NavDropdown group={TEAMS_AND_PLAYERS} />
          <NavDropdown group={MEDIA} />
          <NavLink href="/communaute">Communauté</NavLink>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Link href="/recherche" aria-label="Rechercher" className="rounded-md p-2 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="9" cy="9" r="6" />
              <path d="m14 14 4 4" />
            </svg>
          </Link>
          {viewer ? (
            <>
              <NotificationBell userId={viewer.id} initialCount={unread} />
              <div className="hidden items-center gap-1 xl:flex">
                <NavLink href="/messages">Messages</NavLink>
                {viewer.isStaff && <NavDropdown group={STAFF} />}
                <Link href="/profil" className="ml-1 whitespace-nowrap rounded-full border border-[var(--border)] px-4 py-1.5 text-sm text-zinc-100 transition-colors hover:border-[var(--accent)] hover:bg-white/5">
                  Mon profil
                </Link>
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 xl:flex">
              <NavLink href="/connexion">Connexion</NavLink>
              <Link href="/inscription" className="whitespace-nowrap rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium hover:brightness-110">
                S’inscrire
              </Link>
            </div>
          )}
          <MobileMenu sections={mobileSections} accountItems={mobileAccount} />
        </div>
      </nav>
    </header>
  );
}
