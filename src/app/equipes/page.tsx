import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EmptyState, ErrorState, Logo, PageHeader, Pager } from '@/components/ui';
import type { TeamLite } from '@/lib/data/types';
import { flag } from '@/lib/format';
import { cleanSearch, pageNumber } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Équipes' };

const PAGE_SIZE = 24;
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EquipesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const page = pageNumber(sp.page);

  const supabase = await createClient();
  let query = supabase.from('teams').select('id, slug, name, tag, logo_url, country_code').eq('is_active', true).order('name');
  if (q) query = query.ilike('name', `%${q}%`);
  const { data, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE).returns<TeamLite[]>();
  const rows = data ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader title="Équipes" subtitle="Les équipes suivies sur ESPORT HUB." />
      <form action="/equipes" className="mb-8 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Rechercher une équipe…" aria-label="Rechercher une équipe" className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--accent)]" />
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium">Rechercher</button>
      </form>
      {error ? (
        <ErrorState />
      ) : rows.length === 0 ? (
        <EmptyState>{q ? 'Aucune équipe ne correspond à votre recherche.' : 'Aucune équipe n’est encore enregistrée.'}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.slice(0, PAGE_SIZE).map((team) => (
            <li key={team.id}>
              <Link href={`/equipes/${team.slug}`}>
                <Card className="flex items-center gap-3 p-4 transition hover:border-[var(--accent)]">
                  <Logo src={team.logo_url} name={team.name} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{team.name}</span>
                    <span className="text-xs text-zinc-400">{[team.tag, flag(team.country_code)].filter(Boolean).join(' · ')}</span>
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager basePath="/equipes" params={q ? { q } : {}} page={page} hasNext={rows.length > PAGE_SIZE} />
    </main>
  );
}
