import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { NavLink } from '@/components/nav-links';
import { ENTITIES, ENTITY_GROUPS } from '@/lib/admin/entities';
import { getViewer } from '@/lib/data/community';

export const metadata: Metadata = { title: { default: 'Administration', template: '%s — Administration' } };

/** Accès réservé au staff (éditeur, admin, super admin). La RLS reste la vraie barrière côté base. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion?next=/admin');
  if (!viewer.isStaff) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav aria-label="Administration" className="mb-8 space-y-2 border-b border-[var(--border)] pb-4">
        <div className="flex flex-wrap items-center gap-1">
          <NavLink href="/admin" exact>Tableau de bord</NavLink>
        </div>
        {ENTITY_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-wrap items-center gap-1">
            <span className="mr-2 w-24 text-xs uppercase tracking-wider text-zinc-500">{group.title}</span>
            {group.keys.map((key) => (
              <NavLink key={key} href={`/admin/${key}`}>{ENTITIES[key].plural}</NavLink>
            ))}
            {group.links?.map((link) => (
              <NavLink key={link.href} href={link.href}>{link.label}</NavLink>
            ))}
          </div>
        ))}
      </nav>
      {children}
    </div>
  );
}
