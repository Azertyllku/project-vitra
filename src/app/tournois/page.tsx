import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, ErrorState, FilterTabs, PageHeader, Pager } from '@/components/ui';
import { fetchGames } from '@/lib/data/catalog';
import type { TournamentRow } from '@/lib/data/types';
import { TOURNAMENT_STATUS_LABEL, formatDate, formatMoney } from '@/lib/format';
import { one, pageNumber } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Tournois' };

const PAGE_SIZE = 18;
const TABS = [
  { key: 'tous', label: 'Tous', status: null },
  { key: 'en-cours', label: 'En cours', status: 'ongoing' },
  { key: 'a-venir', label: 'À venir', status: 'upcoming' },
  { key: 'termines', label: 'Terminés', status: 'finished' },
] as const;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TournoisPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === one(sp.statut)) ?? TABS[0];
  const gameSlug = one(sp.jeu);
  const page = pageNumber(sp.page);

  const supabase = await createClient();
  const { games } = await fetchGames();
  const game = games.find((g) => g.slug === gameSlug);

  let query = supabase
    .from('tournaments')
    .select('id, slug, name, organizer, format, status, region, starts_at, ends_at, prize_pool, currency, logo_url, description, data_source, game:games(slug, name)')
    .order('starts_at', { ascending: tab.key === 'a-venir', nullsFirst: false });
  if (tab.status) query = query.eq('status', tab.status);
  if (game) query = query.eq('game_id', game.id);
  const { data, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE).returns<TournamentRow[]>();
  const rows = data ?? [];

  const link = (statut: string, jeu?: string) => {
    const params = new URLSearchParams({ statut });
    if (jeu) params.set('jeu', jeu);
    return `/tournois?${params.toString()}`;
  };
  const params: Record<string, string> = { statut: tab.key };
  if (game) params.jeu = game.slug;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader title="Tournois" subtitle="Compétitions à venir, en cours et terminées." />
      <div className="space-y-4">
        <FilterTabs items={TABS.map((t) => ({ label: t.label, href: link(t.key, game?.slug), active: t.key === tab.key }))} />
        <FilterTabs
          items={[
            { label: 'Tous les jeux', href: link(tab.key), active: !game },
            ...games.map((g) => ({ label: g.short_name ?? g.name, href: link(tab.key, g.slug), active: g.slug === game?.slug })),
          ]}
        />
      </div>
      <div className="mt-8">
        {error ? (
          <ErrorState />
        ) : rows.length === 0 ? (
          <EmptyState>Aucun tournoi ne correspond à ces filtres.</EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {rows.slice(0, PAGE_SIZE).map((t) => (
              <li key={t.id}>
                <Link href={`/tournois/${t.slug}`}>
                  <Card className="p-5 transition hover:border-[var(--accent)]">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-400">{t.game?.name}</span>
                      <span className="flex gap-2">
                        {t.data_source === 'demo' && <Badge tone="amber">Démonstration</Badge>}
                        <Badge tone={t.status === 'ongoing' ? 'violet' : 'neutral'}>{TOURNAMENT_STATUS_LABEL[t.status]}</Badge>
                      </span>
                    </div>
                    <p className="text-lg font-semibold">{t.name}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {formatDate(t.starts_at)} → {formatDate(t.ends_at)}
                      {formatMoney(t.prize_pool, t.currency) ? ` · ${formatMoney(t.prize_pool, t.currency)}` : ''}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Pager basePath="/tournois" params={params} page={page} hasNext={rows.length > PAGE_SIZE} />
    </main>
  );
}
