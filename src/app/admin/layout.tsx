import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { NavLink } from '@/components/nav-links';
import { ENTITIES, ENTITY_ORDER } from '@/lib/admin/entities';
import { getViewer } from '@/lib/data/community';

export const metadata: Metadata = { title: { default: 'Administration', template: '%s — Administration' } };

/** Accès réservé au staff (éditeur, admin, super admin). La RLS reste la vraie barrière côté base. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion?next=/admin');
  if (!viewer.isStaff) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav aria-label="Administration" className="mb-8 flex flex-wrap items-center gap-1 border-b border-[var(--border)] pb-4">
        <NavLink href="/admin" exact>Tableau de bord</NavLink>
        {ENTITY_ORDER.map((key) => (
          <NavLink key={key} href={`/admin/${key}`}>{ENTITIES[key].plural}</NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
