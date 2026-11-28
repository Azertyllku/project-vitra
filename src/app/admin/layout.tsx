import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AdminSidebar, type AdminNavGroup } from '@/components/admin-sidebar';
import { ENTITIES, ENTITY_GROUPS } from '@/lib/admin/entities';
import { getViewer } from '@/lib/data/community';

export const metadata: Metadata = { title: { default: 'Administration', template: '%s — Administration' }, robots: { index: false } };

/** Accès réservé au staff (éditeur, admin, super admin). La RLS reste la vraie barrière côté base. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion?next=/admin');
  if (!viewer.isStaff) notFound();

  const groups: AdminNavGroup[] = ENTITY_GROUPS.map((group) => ({
    title: group.title,
    items: [...group.keys.map((key) => ({ label: ENTITIES[key].plural, href: `/admin/${key}` })), ...(group.links ?? [])],
  }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row lg:gap-10">
      <AdminSidebar groups={groups} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
