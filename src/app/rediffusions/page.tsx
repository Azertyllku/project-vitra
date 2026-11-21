import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, ErrorState, FilterTabs, PageHeader, Pager } from '@/components/ui';
import { VodGrid } from '@/components/vod-card';
import { fetchGames } from '@/lib/data/catalog';
import { KINDS, KIND_LABEL, fetchVods, type VodKind } from '@/lib/data/video';
import { cleanSearch, one, pageNumber } from '@/lib/params';

export const metadata: Metadata = { title: 'Rediffusions' };

const PAGE_SIZE = 18;
const DURATIONS = { court: 'Moins de 10 min', moyen: '10 à 45 min', long: 'Plus de 45 min' } as const;
type Duration = keyof typeof DURATIONS;
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RediffusionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const type = KINDS.find((k) => k === one(sp.type)) as VodKind | undefined;
  const sort = one(sp.tri) === 'populaires' ? 'populaires' : 'recent';
  const duration = (Object.keys(DURATIONS) as Duration[]).find((d) => d === one(sp.duree));
  const q = cleanSearch(sp.q);
  const page = pageNumber(sp.page);

  const { games } = await fetchGames();
  const game = games.find((g) => g.slug === one(sp.jeu));

  const { vods, hasMore, failed } = await fetchVods({
    gameSlug: game?.slug,
    kind: type,
    q: q || undefined,
    sort,
    duration,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const current: Record<string, string | undefined> = { type, jeu: game?.slug, tri: sort === 'populaires' ? 'populaires' : undefined, duree: duration, q: q || undefined };
  const href = (override: Record<string, string | undefined>) => {
    const merged = { ...current, ...override };
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => value && params.set(key, value));
    const qs = params.toString();
    return qs ? `/rediffusions?${qs}` : '/rediffusions';
  };
  const pagerParams = Object.fromEntries(Object.entries(current).filter(([, v]) => v)) as Record<string, string>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader title="Rediffusions" subtitle="Matchs complets, highlights, meilleures actions et résumés." />

      <form action="/rediffusions" className="mb-6 flex gap-2">
        {type && <input type="hidden" name="type" value={type} />}
        {game && <input type="hidden" name="jeu" value={game.slug} />}
        {current.tri && <input type="hidden" name="tri" value="populaires" />}
        {duration && <input type="hidden" name="duree" value={duration} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher une vidéo…"
          aria-label="Rechercher une vidéo"
          className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium">Rechercher</button>
      </form>

      <div className="space-y-3">
        <FilterTabs items={[{ label: 'Tous les types', href: href({ type: undefined, page: undefined }), active: !type }, ...KINDS.map((k) => ({ label: KIND_LABEL[k], href: href({ type: k }), active: k === type }))]} />
        <FilterTabs items={[{ label: 'Tous les jeux', href: href({ jeu: undefined }), active: !game }, ...games.map((g) => ({ label: g.short_name ?? g.name, href: href({ jeu: g.slug }), active: g.slug === game?.slug }))]} />
        <FilterTabs items={[{ label: 'Plus récentes', href: href({ tri: undefined }), active: sort === 'recent' }, { label: 'Les plus regardées', href: href({ tri: 'populaires' }), active: sort === 'populaires' }]} />
        <FilterTabs items={[{ label: 'Toutes durées', href: href({ duree: undefined }), active: !duration }, ...(Object.keys(DURATIONS) as Duration[]).map((d) => ({ label: DURATIONS[d], href: href({ duree: d }), active: d === duration }))]} />
      </div>

      <div className="mt-8">
        {failed ? (
          <ErrorState />
        ) : vods.length === 0 ? (
          <EmptyState>Aucune rediffusion ne correspond à ces filtres.</EmptyState>
        ) : (
          <VodGrid vods={vods} />
        )}
      </div>
      <Pager basePath="/rediffusions" params={pagerParams} page={page} hasNext={hasMore} />
      {sort === 'populaires' && <p className="mt-6 text-xs text-zinc-500">Le classement tient compte des membres connectés ayant ouvert la vidéo. <Link href="/rediffusions" className="underline">Réinitialiser</Link></p>}
    </main>
  );
}
