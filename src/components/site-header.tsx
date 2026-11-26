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

export async function SiteHeader() {
  const viewer = await getViewer();
  let unread = 0;
  if (viewer) {
    const supabase = await createClient();
    const { count } = await supabase.from('user_notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    unread = count ?? 0;
  }

  const mobileSections = [
    {
      items: [
        { label: 'Accueil', href: '/' },
        { label: 'Live', href: '/live' },
        { label: 'Matchs', href: '/matchs' },
        { label: 'Rediffusions', href: '/rediffusions' },
        { label: 'Communauté', href: '/communaute' },
      ],
    },
    { title: COMPETITIONS.label, items: COMPETITIONS.items },
    { title: TEAMS_AND_PLAYERS.label, items: TEAMS_AND_PLAYERS.items },
  ];
  const mobileAccount = viewer
    ? [
        { label: 'Messages', href: '/messages' },
        ...(viewer.isStaff ? [{ label: 'Modération', href: '/moderation' }] : []),
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

        <div className="hidden flex-1 items-center gap-1 lg:flex">
          <NavLink href="/live">Live</NavLink>
          <NavLink href="/matchs">Matchs</NavLink>
          <NavDropdown group={COMPETITIONS} />
          <NavDropdown group={TEAMS_AND_PLAYERS} />
          <NavLink href="/rediffusions">Rediffusions</NavLink>
          <NavLink href="/communaute">Communauté</NavLink>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {viewer ? (
            <>
              <NotificationBell userId={viewer.id} initialCount={unread} />
              <div className="hidden items-center gap-1 lg:flex">
                <NavLink href="/messages">Messages</NavLink>
                {viewer.isStaff && <NavLink href="/moderation">Modération</NavLink>}
                <Link href="/profil" className="ml-1 whitespace-nowrap rounded-full border border-[var(--border)] px-4 py-1.5 text-sm text-zinc-100 transition-colors hover:border-[var(--accent)] hover:bg-white/5">
                  Mon profil
                </Link>
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
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
