import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmbedPlayer } from '@/components/embed-player';
import { VodFavoriteButton } from '@/components/favorite-buttons';
import { AddToPlaylist } from '@/components/playlist-controls';
import { Badge, SectionTitle } from '@/components/ui';
import { ViewTracker } from '@/components/view-tracker';
import { VodGrid } from '@/components/vod-card';
import { KIND_LABEL, fetchVod, fetchVods } from '@/lib/data/video';
import { formatDate } from '@/lib/format';
import { one } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';
import { formatDuration, languageName } from '@/lib/video-utils';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vod = await fetchVod(id);
  return { title: vod?.title ?? 'Vidéo introuvable', description: vod?.description ?? undefined };
}

export default async function RediffusionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const vod = await fetchVod(id);
  if (!vod) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let favorite = false;
  let resumeFrom = 0;
  let playlists: { id: string; name: string }[] = [];
  if (user) {
    const [fav, view, lists] = await Promise.all([
      supabase.from('video_favorites').select('vod_id').eq('user_id', user.id).eq('vod_id', vod.id).maybeSingle(),
      supabase.from('video_views').select('progress_seconds, completed').eq('user_id', user.id).eq('vod_id', vod.id).maybeSingle<{ progress_seconds: number; completed: boolean }>(),
      supabase.from('playlists').select('id, name').eq('user_id', user.id).order('created_at').returns<{ id: string; name: string }[]>(),
    ]);
    favorite = Boolean(fav.data);
    // La reprise automatique n'est possible que pour les flux HLS (lecteur qui expose sa position).
    if (vod.provider === 'hls' && view.data && !view.data.completed && view.data.progress_seconds > 10) resumeFrom = view.data.progress_seconds;
    playlists = lists.data ?? [];
  }

  const requested = Number.parseInt(one(sp.t) ?? '', 10);
  const start = Number.isFinite(requested) && requested >= 0 ? requested : resumeFrom;
  const related = await fetchVods({ gameSlug: vod.game?.slug, excludeId: vod.id, matchId: vod.match_id ?? undefined, limit: 6 });
  const duration = formatDuration(vod.duration_seconds);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <ViewTracker vodId={vod.id} />
      <p className="mb-3 text-sm text-zinc-400">
        <Link href="/rediffusions" className="hover:text-white">Rediffusions</Link>
        {vod.game && (
          <>
            {' · '}
            <Link href={`/jeux/${vod.game.slug}`} className="hover:text-white">{vod.game.name}</Link>
          </>
        )}
        {vod.tournament && (
          <>
            {' · '}
            <Link href={`/tournois/${vod.tournament.slug}`} className="hover:text-white">{vod.tournament.name}</Link>
          </>
        )}
      </p>

      <EmbedPlayer key={`${vod.id}-${start}`} provider={vod.provider} embedRef={vod.embed_ref} title={vod.title} startSeconds={start} vodId={vod.id} />

      <h1 className="mt-5 text-2xl font-bold">{vod.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
        <Badge>{KIND_LABEL[vod.kind]}</Badge>
        <span>{formatDate(vod.published_at)}</span>
        {duration && <span>· {duration}</span>}
        <span>· {languageName(vod.language)}</span>
        {vod.match_id && (
          <Link href={`/matchs/${vod.match_id}`} className="text-[var(--accent-blue)] hover:underline">
            · Fiche et statistiques du match
          </Link>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <VodFavoriteButton vodId={vod.id} initial={favorite} loggedIn={Boolean(user)} />
        {user &&
          (playlists.length > 0 ? (
            <AddToPlaylist vodId={vod.id} playlists={playlists} />
          ) : (
            <Link href="/profil/videos?onglet=playlists" className="text-sm text-[var(--accent-blue)] hover:underline">
              Créer une playlist
            </Link>
          ))}
      </div>

      {vod.description && <p className="mt-5 max-w-3xl text-zinc-300">{vod.description}</p>}
      {vod.rights_holder && <p className="mt-3 text-xs text-zinc-500">Vidéo proposée avec l’autorisation de {vod.rights_holder}.</p>}

      {vod.chapters.length > 0 && (
        <>
          <SectionTitle>Chapitres</SectionTitle>
          <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {vod.chapters.map((chapter) => (
              <li key={chapter.id}>
                <Link href={`/rediffusions/${vod.id}?t=${chapter.start_seconds}`} className="flex gap-4 px-4 py-3 text-sm hover:bg-white/5">
                  <span className="w-16 shrink-0 font-mono text-[var(--accent-blue)]">{formatDuration(chapter.start_seconds) || '0:00'}</span>
                  <span>{chapter.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {related.vods.length > 0 && (
        <>
          <SectionTitle>À voir aussi</SectionTitle>
          <VodGrid vods={related.vods} />
        </>
      )}
    </main>
  );
}
