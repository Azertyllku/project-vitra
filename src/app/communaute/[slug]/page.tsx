import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JoinCommunityButton } from '@/components/community-actions';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-forms';
import { Card, EmptyState, ErrorState, Pager } from '@/components/ui';
import { fetchPosts, fetchReactionData, getViewer } from '@/lib/data/community';
import { pageNumber } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 15;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
interface Community { id: string; slug: string; name: string; description: string | null; kind: string }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('communities').select('name, description').eq('slug', slug).maybeSingle<{ name: string; description: string | null }>();
  return { title: data?.name ?? 'Communauté introuvable', description: data?.description ?? undefined };
}

export default async function CommunautePageDetail({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const supabase = await createClient();
  const { data: community } = await supabase.from('communities').select('id, slug, name, description, kind').eq('slug', slug).maybeSingle<Community>();
  if (!community) notFound();

  const viewer = await getViewer();
  const [{ count }, membership, feed, accounts] = await Promise.all([
    supabase.from('community_members').select('user_id', { count: 'exact', head: true }).eq('community_id', community.id),
    viewer ? supabase.from('community_members').select('user_id').eq('community_id', community.id).eq('user_id', viewer.id).maybeSingle() : Promise.resolve({ data: null }),
    fetchPosts({ communityId: community.id, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    viewer ? supabase.from('player_game_accounts').select('id, display_name, provider, game:games(name)').eq('profile_id', viewer.id).returns<{ id: string; display_name: string | null; provider: string; game: { name: string } | null }[]>() : Promise.resolve({ data: [] }),
  ]);
  const isMember = Boolean(membership.data);
  const reactions = await fetchReactionData('post', feed.posts.map((p) => p.id), viewer?.id ?? null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-3 text-sm text-zinc-400"><Link href="/communaute" className="hover:text-white">Communauté</Link></p>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{community.name}</h1>
          {community.description && <p className="mt-1 text-zinc-400">{community.description}</p>}
          <p className="mt-1 text-xs text-zinc-500">{count ?? 0} membre{(count ?? 0) > 1 ? 's' : ''}</p>
        </div>
        <JoinCommunityButton communityId={community.id} initial={isMember} />
      </header>

      <Card className="mb-6 p-5">
        {isMember ? (
          <PostComposer communityId={community.id} accounts={(accounts.data ?? []).map((a) => ({ id: a.id, label: `${a.game?.name ?? 'Jeu'} · ${a.display_name ?? a.provider}` }))} />
        ) : (
          <p className="text-sm text-zinc-400">Rejoignez cette communauté pour y publier.</p>
        )}
      </Card>

      {feed.failed ? (
        <ErrorState />
      ) : feed.posts.length === 0 ? (
        <EmptyState>Aucune publication dans cette communauté pour le moment.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {feed.posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} counts={reactions.counts[post.id] ?? {}} mine={reactions.mine[post.id] ?? null} viewer={viewer} />
            </li>
          ))}
        </ul>
      )}
      <Pager basePath={`/communaute/${community.slug}`} params={{}} page={page} hasNext={feed.hasMore} />
    </main>
  );
}
