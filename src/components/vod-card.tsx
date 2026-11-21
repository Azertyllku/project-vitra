import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { KIND_LABEL, type VodCardRow } from '@/lib/data/video';
import { formatDate } from '@/lib/format';
import { formatDuration } from '@/lib/video-utils';

export function VodCard({ vod }: { vod: VodCardRow }) {
  const duration = formatDuration(vod.duration_seconds);
  return (
    <Link href={`/rediffusions/${vod.id}`} className="group block">
      <Card className="overflow-hidden transition group-hover:border-[var(--accent)]">
        <div className="relative aspect-video bg-gradient-to-br from-violet-900/50 to-blue-900/40">
          {vod.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vod.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
          {duration && <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs tabular-nums">{duration}</span>}
        </div>
        <div className="p-4">
          <p className="line-clamp-2 font-medium">{vod.title}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {vod.game?.name} · {formatDate(vod.published_at)}
          </p>
          <div className="mt-2">
            <Badge>{KIND_LABEL[vod.kind]}</Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function VodGrid({ vods }: { vods: VodCardRow[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vods.map((vod) => (
        <li key={vod.id}>
          <VodCard vod={vod} />
        </li>
      ))}
    </ul>
  );
}
