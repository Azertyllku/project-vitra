import type { Metadata } from 'next';
import Link from 'next/link';
import { TableRefresh } from '@/components/table-refresh';
import { Badge, Card, EmptyState, ErrorState, PageHeader, SectionTitle, StatusBadge } from '@/components/ui';
import { fetchStreams, type StreamRow } from '@/lib/data/video';
import { formatDateTime } from '@/lib/format';
import { languageName } from '@/lib/video-utils';

export const metadata: Metadata = { title: 'Live' };

function StreamCard({ stream }: { stream: StreamRow }) {
  const languages = [...new Set(stream.sources.map((s) => languageName(s.language)))];
  return (
    <Link href={`/live/${stream.id}`} className="group block">
      <Card className="p-5 transition group-hover:border-[var(--accent)]">
        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-zinc-400">
          <span>
            {stream.game?.name}
            {stream.tournament ? ` · ${stream.tournament.name}` : ''}
          </span>
          <StatusBadge status={stream.status === 'live' ? 'live' : 'scheduled'} />
        </div>
        <p className="text-lg font-semibold">{stream.title}</p>
        <p className="mt-1 text-sm text-zinc-400">{formatDateTime(stream.starts_at)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {languages.length > 0 ? languages.map((l) => <Badge key={l}>{l}</Badge>) : <span className="text-xs text-zinc-500">Aucune source autorisée pour le moment</span>}
        </div>
      </Card>
    </Link>
  );
}

export default async function LivePage() {
  const [live, scheduled] = await Promise.all([fetchStreams('live', 12), fetchStreams('scheduled', 12)]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <TableRefresh tables={['streams', 'stream_sources']} channelName="live-page" />
      <PageHeader title="Live" subtitle="Diffusions officielles et autorisées des compétitions." />

      <SectionTitle>En direct</SectionTitle>
      {live.failed ? (
        <ErrorState />
      ) : live.streams.length === 0 ? (
        <EmptyState>Aucune diffusion en direct pour le moment.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {live.streams.map((s) => (
            <li key={s.id}>
              <StreamCard stream={s} />
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Prochaines diffusions</SectionTitle>
      {scheduled.failed ? (
        <ErrorState />
      ) : scheduled.streams.length === 0 ? (
        <EmptyState>Aucune diffusion programmée.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {scheduled.streams.map((s) => (
            <li key={s.id}>
              <StreamCard stream={s} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
