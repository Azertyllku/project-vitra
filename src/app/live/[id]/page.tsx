import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmbedPlayer } from '@/components/embed-player';
import { FavoriteButton } from '@/components/favorite-buttons';
import { MatchCard } from '@/components/match-card';
import { TableRefresh } from '@/components/table-refresh';
import { Badge, EmptyState, SectionTitle, StatusBadge } from '@/components/ui';
import { fetchMatches } from '@/lib/data/matches';
import { fetchStream, fetchVods } from '@/lib/data/video';
import { VodGrid } from '@/components/vod-card';
import { formatDateTime } from '@/lib/format';
import { one } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';
import { languageName } from '@/lib/video-utils';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const stream = await fetchStream(id);
  return { title: stream?.title ?? 'Diffusion introuvable' };
}

export default async function LiveStreamPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const stream = await fetchStream(id);
  if (!stream) notFound();

  const source = stream.sources.find((s) => s.id === one(sp.source)) ?? stream.sources[0];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const match = stream.match_id ? (await fetchMatches({ ids: [stream.match_id], limit: 1 })).matches[0] : undefined;
  let following = false;
  if (user && stream.match_id) {
    const { data } = await supabase
      .from('user_favorites')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_type', 'match')
      .eq('entity_id', stream.match_id)
      .maybeSingle();
    following = Boolean(data);
  }
  const replays = stream.status === 'ended' && stream.match_id ? await fetchVods({ matchId: stream.match_id, limit: 6 }) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TableRefresh tables={['streams', 'stream_sources']} channelName={`stream-${stream.id}`} />

      <p className="mb-3 text-sm text-zinc-400">
        <Link href="/live" className="hover:text-white">Live</Link>
        {stream.game ? ` · ${stream.game.name}` : ''}
        {stream.tournament ? ` · ${stream.tournament.name}` : ''}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{stream.title}</h1>
        <StatusBadge status={stream.status === 'live' ? 'live' : stream.status === 'ended' ? 'finished' : 'scheduled'} />
      </div>

      {stream.status === 'scheduled' && <p className="mb-4 text-zinc-400">Cette diffusion commence le {formatDateTime(stream.starts_at)}.</p>}
      {stream.status === 'ended' && <p className="mb-4 text-zinc-400">Cette diffusion est terminée.</p>}

      {source ? (
        <>
          <EmbedPlayer provider={source.provider} embedRef={source.embed_ref} title={stream.title} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {stream.sources.map((s) => (
              <Link
                key={s.id}
                href={`/live/${stream.id}?source=${s.id}`}
                aria-current={s.id === source.id ? 'true' : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${s.id === source.id ? 'border-[var(--accent)] bg-[var(--accent)]/20' : 'border-[var(--border)] text-zinc-400 hover:text-white'}`}
              >
                {languageName(s.language)}
                {s.label ? ` · ${s.label}` : ''}
                {s.is_official ? ' · officielle' : ''}
              </Link>
            ))}
          </div>
          {source.rights_holder && <p className="mt-3 text-xs text-zinc-500">Diffusion proposée avec l’autorisation de {source.rights_holder}.</p>}
        </>
      ) : (
        <EmptyState>Aucune source de diffusion autorisée n’est disponible pour cet événement pour le moment.</EmptyState>
      )}

      {match && (
        <>
          <SectionTitle>Le match</SectionTitle>
          <MatchCard match={match} />
          <div className="mt-4">
            <FavoriteButton entityType="match" entityId={match.id} initial={following} loggedIn={Boolean(user)} labelOff="Suivre ce match" labelOn="Match suivi" />
          </div>
        </>
      )}

      {replays && replays.vods.length > 0 && (
        <>
          <SectionTitle>Rediffusions</SectionTitle>
          <VodGrid vods={replays.vods} />
        </>
      )}
      <p className="sr-only">
        <Badge>{stream.status}</Badge>
      </p>
    </main>
  );
}
