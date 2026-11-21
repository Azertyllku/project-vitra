import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreatePlaylistForm, DeletePlaylistButton, RemoveItemButton } from '@/components/playlist-controls';
import { Card, EmptyState, ErrorState, FilterTabs, PageHeader } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { one } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';
import { formatDuration } from '@/lib/video-utils';

export const metadata: Metadata = { title: 'Mes vidéos' };

const TABS = [
  { key: 'historique', label: 'Historique' },
  { key: 'favoris', label: 'Favoris' },
  { key: 'playlists', label: 'Playlists' },
] as const;

interface VodMini {
  id: string;
  title: string;
  duration_seconds: number | null;
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function MesVideosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === one(sp.onglet)) ?? TABS[0];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/connexion?next=/profil/videos');

  const VOD = 'vod:vods(id, title, duration_seconds)';
  const history = tab.key === 'historique'
    ? await supabase.from('video_views').select(`progress_seconds, completed, last_watched_at, ${VOD}`).eq('user_id', user.id).order('last_watched_at', { ascending: false }).limit(50).returns<{ progress_seconds: number; completed: boolean; last_watched_at: string; vod: VodMini | null }[]>()
    : null;
  const favorites = tab.key === 'favoris'
    ? await supabase.from('video_favorites').select(`created_at, ${VOD}`).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100).returns<{ created_at: string; vod: VodMini | null }[]>()
    : null;
  const playlists = tab.key === 'playlists'
    ? await supabase.from('playlists').select(`id, name, items:playlist_items(position, added_at, ${VOD})`).eq('user_id', user.id).order('created_at').returns<{ id: string; name: string; items: { position: number; added_at: string; vod: VodMini | null }[] }[]>()
    : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader title="Mes vidéos" subtitle="Historique, favoris et playlists.">
        <Link href="/profil" className="text-sm text-[var(--accent-blue)] hover:underline">← Mon profil</Link>
      </PageHeader>
      <FilterTabs items={TABS.map((t) => ({ label: t.label, href: `/profil/videos?onglet=${t.key}`, active: t.key === tab.key }))} />

      <div className="mt-8">
        {history && (history.error ? <ErrorState /> : history.data.length === 0 ? <EmptyState>Vous n’avez encore regardé aucune rediffusion.</EmptyState> : (
          <Card><ul className="divide-y divide-[var(--border)]">
            {history.data.filter((row) => row.vod).map((row) => (
              <li key={row.vod!.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <Link href={`/rediffusions/${row.vod!.id}`} className="min-w-0 flex-1 truncate hover:text-[var(--accent-blue)]">{row.vod!.title}</Link>
                <span className="shrink-0 text-xs text-zinc-400">
                  {row.completed ? 'Terminée' : row.progress_seconds > 0 ? `Reprise à ${formatDuration(row.progress_seconds)}` : formatDate(row.last_watched_at)}
                </span>
              </li>
            ))}
          </ul></Card>
        ))}

        {favorites && (favorites.error ? <ErrorState /> : favorites.data.length === 0 ? <EmptyState>Aucune vidéo en favori.</EmptyState> : (
          <Card><ul className="divide-y divide-[var(--border)]">
            {favorites.data.filter((row) => row.vod).map((row) => (
              <li key={row.vod!.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <Link href={`/rediffusions/${row.vod!.id}`} className="min-w-0 flex-1 truncate hover:text-[var(--accent-blue)]">{row.vod!.title}</Link>
                <span className="shrink-0 text-xs text-zinc-400">{formatDuration(row.vod!.duration_seconds)}</span>
              </li>
            ))}
          </ul></Card>
        ))}

        {playlists && (
          <div className="space-y-6">
            <CreatePlaylistForm />
            {playlists.error ? <ErrorState /> : playlists.data.length === 0 ? <EmptyState>Aucune playlist. Créez-en une ci-dessus, puis ajoutez-y des rediffusions depuis leur page.</EmptyState> : playlists.data.map((playlist) => (
              <Card key={playlist.id} className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{playlist.name}</h2>
                  <DeletePlaylistButton playlistId={playlist.id} name={playlist.name} />
                </div>
                {playlist.items.filter((item) => item.vod).length === 0 ? (
                  <p className="text-sm text-zinc-500">Playlist vide.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border)] text-sm">
                    {[...playlist.items].filter((item) => item.vod).sort((a, b) => a.position - b.position || a.added_at.localeCompare(b.added_at)).map((item) => (
                      <li key={item.vod!.id} className="flex items-center justify-between gap-3 py-2">
                        <Link href={`/rediffusions/${item.vod!.id}`} className="min-w-0 flex-1 truncate hover:text-[var(--accent-blue)]">{item.vod!.title}</Link>
                        <RemoveItemButton playlistId={playlist.id} vodId={item.vod!.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
