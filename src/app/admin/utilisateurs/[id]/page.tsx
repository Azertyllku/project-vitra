import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminDeleteButton } from '@/components/admin-delete-button';
import { AdminForm } from '@/components/admin-form';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { addSanction, grantRole, liftSanction, revokeRole } from '@/app/admin/user-actions';
import type { Field } from '@/lib/admin/entities';
import { formatParis } from '@/lib/admin/time';
import { getViewer } from '@/lib/data/community';
import { one } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Gestion d\u2019un membre' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_FIELDS: Field[] = [
  {
    name: 'role', label: 'Rôle à attribuer', type: 'select', required: true, default: 'editor',
    options: [
      { value: 'member', label: 'Membre' },
      { value: 'premium', label: 'Premium (inutilisé)' },
      { value: 'creator', label: 'Créateur' },
      { value: 'editor', label: 'Éditeur (accès à l’administration)' },
      { value: 'admin', label: 'Administrateur' },
      { value: 'super_admin', label: 'Super administrateur' },
    ],
  },
];

const SANCTION_FIELDS: Field[] = [
  {
    name: 'kind', label: 'Type', type: 'select', required: true, default: 'mute',
    options: [
      { value: 'mute', label: 'Sourdine (publication bloquée)' },
      { value: 'ban', label: 'Bannissement (publication bloquée)' },
    ],
  },
  { name: 'reason', label: 'Motif', type: 'textarea', required: true, max: 500 },
  { name: 'until', label: 'Fin de la sanction (heure de Paris)', type: 'datetime', help: 'Laisser vide pour une sanction sans date de fin.' },
];

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  'ok:role': { ok: true, text: 'Rôle retiré.' },
  'ok:leve': { ok: true, text: 'Sanction levée.' },
  'erreur:droits': { ok: false, text: 'Action refusée : droits insuffisants ou élément introuvable.' },
  'erreur:soi': { ok: false, text: 'Vous ne pouvez pas retirer votre propre rôle de super administrateur.' },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUserPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const [profileRes, rolesRes, sanctionsRes, myRolesRes] = await Promise.all([
    supabase.from('profiles').select('id, username, esport_id, display_name, created_at').eq('id', id).maybeSingle<{ id: string; username: string; esport_id: string; display_name: string | null; created_at: string }>(),
    supabase.from('user_roles').select('role, granted_at').eq('user_id', id).returns<{ role: string; granted_at: string }[]>(),
    supabase.from('user_sanctions').select('id, kind, reason, until, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(50).returns<{ id: string; kind: string; reason: string | null; until: string | null; created_at: string }[]>(),
    viewer ? supabase.from('user_roles').select('role').eq('user_id', viewer.id).eq('role', 'super_admin') : Promise.resolve({ data: [] as { role: string }[] }),
  ]);
  const profile = profileRes.data;
  if (!profile) notFound();
  const roles = rolesRes.data ?? [];
  const sanctions = sanctionsRes.data ?? [];
  const isSuperAdmin = (myRolesRes.data ?? []).length > 0;
  const notice = NOTICES[`${one(sp.ok) ? 'ok' : 'erreur'}:${one(sp.ok) ?? one(sp.erreur) ?? ''}`];
  const isActive = (until: string | null) => !until || new Date(until).getTime() > Date.now();

  return (
    <>
      <PageHeader title={profile.username} subtitle={`ESPORT ID ${profile.esport_id} · inscrit le ${formatParis(profile.created_at)}`}>
        <Link href="/admin/utilisateurs" className="text-sm text-[var(--accent-blue)] hover:underline">← Utilisateurs</Link>
      </PageHeader>
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className={`mb-6 rounded-lg border px-3 py-2 text-sm ${notice.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
          {notice.text}
        </p>
      )}

      <SectionTitle>Rôles</SectionTitle>
      <Card className="space-y-4 p-5">
        {roles.length === 0 ? (
          <p className="text-sm text-zinc-400">Aucun rôle visible (les rôles ne sont lisibles que par les administrateurs).</p>
        ) : (
          <ul className="space-y-2">
            {roles.map((role) => (
              <li key={role.role} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>{role.role} <span className="text-xs text-zinc-500">depuis le {formatParis(role.granted_at)}</span></span>
                {isSuperAdmin && (
                  <AdminDeleteButton action={revokeRole.bind(null, id, role.role)} label={role.role} buttonLabel="Retirer" message={`Retirer le rôle « ${role.role} » à ${profile.username} ?`} />
                )}
              </li>
            ))}
          </ul>
        )}
        {isSuperAdmin ? (
          <AdminForm action={grantRole.bind(null, id)} fields={ROLE_FIELDS} values={{ role: 'editor' }} options={{}} submitLabel="Attribuer" />
        ) : (
          <p className="text-xs text-zinc-500">Seuls les super administrateurs peuvent attribuer ou retirer des rôles.</p>
        )}
      </Card>

      <SectionTitle>Sanctions</SectionTitle>
      <Card className="space-y-4 p-5">
        {sanctions.length === 0 ? (
          <EmptyState>Aucune sanction pour ce membre.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {sanctions.map((sanction) => (
              <li key={sanction.id} className="flex flex-wrap items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">
                    {sanction.kind === 'ban' ? 'Bannissement' : 'Sourdine'}{' '}
                    <span className={isActive(sanction.until) ? 'text-red-300' : 'text-zinc-500'}>{isActive(sanction.until) ? '(active)' : '(terminée)'}</span>
                  </p>
                  <p className="text-zinc-300">{sanction.reason ?? '—'}</p>
                  <p className="text-xs text-zinc-500">Posée le {formatParis(sanction.created_at)} · {sanction.until ? `jusqu’au ${formatParis(sanction.until)}` : 'sans date de fin'}</p>
                </div>
                <AdminDeleteButton action={liftSanction.bind(null, id, sanction.id)} label="cette sanction" buttonLabel="Lever" message="Lever cette sanction ?" />
              </li>
            ))}
          </ul>
        )}
        <AdminForm action={addSanction.bind(null, id)} fields={SANCTION_FIELDS} values={{ kind: 'mute', reason: '', until: '' }} options={{}} submitLabel="Appliquer la sanction" />
      </Card>
    </>
  );
}
