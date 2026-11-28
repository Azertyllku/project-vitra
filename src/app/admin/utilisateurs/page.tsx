import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EmptyState, ErrorState, PageHeader, Pager } from '@/components/ui';
import { formatParis } from '@/lib/admin/time';
import { one, pageNumber } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Utilisateurs' };

const PAGE_SIZE = 25;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const q = (one(sp.q) ?? '').trim().slice(0, 60).replace(/[%,()*]/g, ' ');

  const supabase = await createClient();
  let query = supabase.from('profiles').select('id, username, esport_id, created_at').order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (q) query = /^eh-/i.test(q) ? query.eq('esport_id', q.toUpperCase()) : query.ilike('username', `%${q}%`);
  const { data, error } = await query.returns<{ id: string; username: string; esport_id: string; created_at: string }[]>();
  const profiles = (data ?? []).slice(0, PAGE_SIZE);
  const ids = profiles.map((p) => p.id);

  const [rolesRes, sanctionsRes] = ids.length
    ? await Promise.all([
        supabase.from('user_roles').select('user_id, role').in('user_id', ids).returns<{ user_id: string; role: string }[]>(),
        supabase.from('user_sanctions').select('user_id, kind, until').in('user_id', ids).returns<{ user_id: string; kind: string; until: string | null }[]>(),
      ])
    : [{ data: [] as { user_id: string; role: string }[] }, { data: [] as { user_id: string; kind: string; until: string | null }[] }];

  const rolesOf = (id: string) => (rolesRes.data ?? []).filter((r) => r.user_id === id && r.role !== 'member').map((r) => r.role);
  const activeSanction = (id: string) => (sanctionsRes.data ?? []).find((s) => s.user_id === id && (!s.until || new Date(s.until).getTime() > Date.now()));

  return (
    <>
      <PageHeader title="Utilisateurs" subtitle="Rôles et sanctions des membres. Recherche par pseudo ou par ESPORT ID (EH-…)." />
      <form action="/admin/utilisateurs" className="mb-6 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Pseudo ou ESPORT ID…" className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <button type="submit" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-white/5">Chercher</button>
      </form>

      {error ? (
        <ErrorState />
      ) : profiles.length === 0 ? (
        <EmptyState>Aucun membre trouvé.</EmptyState>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-400">
                  <th className="px-4 py-3">Pseudo</th><th className="px-4 py-3">ESPORT ID</th><th className="px-4 py-3">Rôles</th><th className="px-4 py-3">Sanction</th><th className="px-4 py-3">Inscription</th><th />
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const sanction = activeSanction(p.id);
                  return (
                    <tr key={p.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-2">{p.username}</td>
                      <td className="px-4 py-2 font-mono text-xs">{p.esport_id}</td>
                      <td className="px-4 py-2">{rolesOf(p.id).join(', ') || '—'}</td>
                      <td className="px-4 py-2">{sanction ? (sanction.kind === 'ban' ? 'Banni' : 'En sourdine') : '—'}</td>
                      <td className="px-4 py-2">{formatParis(p.created_at)}</td>
                      <td className="px-4 py-2 text-right"><Link href={`/admin/utilisateurs/${p.id}`} className="text-[var(--accent-blue)] hover:underline">Gérer</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Pager basePath="/admin/utilisateurs" params={q ? { q } : {}} page={page} hasNext={(data ?? []).length > PAGE_SIZE} />
        </>
      )}
      <p className="mt-6 text-xs text-zinc-500">Les rôles ne sont visibles que pour les administrateurs ; seuls les super administrateurs peuvent en attribuer ou en retirer.</p>
    </>
  );
}
