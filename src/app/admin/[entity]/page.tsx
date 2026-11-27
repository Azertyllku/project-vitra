import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, EmptyState, ErrorState, PageHeader, Pager } from '@/components/ui';
import { ENTITIES } from '@/lib/admin/entities';
import { one, pageNumber } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 25;

type Props = {
  params: Promise<{ entity: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { entity } = await params;
  return { title: ENTITIES[entity]?.plural ?? 'Administration' };
}

export default async function AdminListPage({ params, searchParams }: Props) {
  const { entity: key } = await params;
  const entity = ENTITIES[key];
  if (!entity) notFound();
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const q = (one(sp.q) ?? '').trim().slice(0, 60).replace(/[%,()*]/g, ' ');

  const supabase = await createClient();
  let query = supabase
    .from(entity.table)
    .select(entity.list.select)
    .order(entity.list.orderBy, { ascending: entity.list.ascending, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (q && entity.searchField) query = query.ilike(entity.searchField, `%${q}%`);
  const { data, error } = await query.returns<Record<string, unknown>[]>();
  const rows = data ?? [];

  return (
    <>
      <PageHeader title={entity.plural} subtitle={entity.description}>
        <Link href={`/admin/${key}/nouveau`} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:brightness-110">
          + Ajouter
        </Link>
      </PageHeader>

      {entity.searchField && (
        <form action={`/admin/${key}`} className="mb-6 flex gap-2">
          <input name="q" defaultValue={q} placeholder="Rechercher…" className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <button type="submit" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-white/5">Chercher</button>
        </form>
      )}

      {error ? (
        <ErrorState />
      ) : rows.length === 0 ? (
        <EmptyState>Aucun élément{q ? ' pour cette recherche' : ' pour le moment'}. Utilisez « + Ajouter » pour créer le premier.</EmptyState>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-400">
                  {entity.list.headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PAGE_SIZE).map((row) => (
                  <tr key={String(row.id)} className="border-t border-[var(--border)]">
                    {entity.list.cells(row).map((cell, index) => <td key={index} className="px-4 py-2">{cell}</td>)}
                    <td className="px-4 py-2 text-right">
                      <Link href={`/admin/${key}/${row.id}`} className="text-[var(--accent-blue)] hover:underline">Modifier</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pager basePath={`/admin/${key}`} params={q ? { q } : {}} page={page} hasNext={rows.length > PAGE_SIZE} />
        </>
      )}
    </>
  );
}
