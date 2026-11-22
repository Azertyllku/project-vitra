import type { Metadata } from 'next';
import Link from 'next/link';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-forms';
import { Card, EmptyState, ErrorState, FilterTabs, PageHeader, Pager } from '@/components/ui';
import { fetchPosts, fetchReactionData, getViewer } from '@/lib/data/community';
import { one, pageNumber } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Communauté' };

const PAGE_SIZE = 15;
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CommunautePage({ searchParams }: Props) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const tab = one(sp.onglet) === 'abonnements' && viewer ? 'abonnements' : 'recent';
  const page = pageNumber(sp.page);
  const supabase = await createClient();

  const { data: communities } = await supabase.from('communities').select('id, slug, name').order('name').returns<{ id: string; slug: string; name: string }[]>();

  let memberOf: string[] = [];
  let followIds: string[] = [];
  let accounts: { id: string; label: string }[] = [];
  if (viewer) {
    const [members, follows, accs] = await Promise.all([
      supabase.from('community_members').select('community_id').eq('user_id', viewer.id).returns<{ community_id: string }[]>(),
      supabase.from('follows').select('followed_id').eq('follower_id', viewer.id).returns<{ followed_id: string }[]>(),
      supabase.from('player_game_accounts').select('id, display_name, provider, game:games(name)').eq('profile_id', viewer.id).returns<{ id: string; display_name: string | null; provider: string; game: { name: string } | null }[]>(),
    ]);
    memberOf = (members.data ?? []).map((m) => m.community_id);
    followIds = (follows.data ?? []).map((f) => f.followed_id);
    accounts = (accs.data ?? []).map((a) => ({ id: a.id, label: `${a.game?.name ?? 'Jeu'} · ${a.display_name ?? a.provider}` }));
  }

  const parts: string[] = [];
  if (followIds.length) parts.push(`author_id.in.(${followIds.join(',')})`);
  if (memberOf.length) parts.push(`community_id.in.(${memberOf.join(',')})`);
  const emptyFollowing = tab === 'abonnements' && parts.length === 0;

  const feed = emptyFollowing
    ? { posts: [], hasMore: false, failed: false }
    : await fetchPosts({ or: tab === 'abonnements' ? parts.join(',') : undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const reactions = await fetchReactionData('post', feed.posts.map((p) => p.id), viewer?.id ?? null);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader title="Communauté" subtitle="Échangez avec les autres joueurs et fans." />
      <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-6">
          <Card className="p-5">
            {viewer ? (
              <PostComposer accounts={accounts} />
            ) : (
              <p className="text-sm text-zinc-400"><Link href="/connexion?next=/communaute" className="text-[var(--accent-blue)] hover:underline">Connectez-vous</Link> ou <Link href="/inscription" className="text-[var(--accent-blue)] hover:underline">créez un compte</Link> pour publier, commenter et réagir.</p>
            )}
          </Card>

          {viewer && <FilterTabs items={[{ label: 'Récent', href: '/communaute', active: tab === 'recent' }, { label: 'Mes abonnements', href: '/communaute?onglet=abonnements', active: tab === 'abonnements' }]} />}

          {feed.failed ? (
            <ErrorState />
          ) : emptyFollowing ? (
            <EmptyState>Abonnez-vous à des membres ou rejoignez une communauté pour remplir ce fil.</EmptyState>
          ) : feed.posts.length === 0 ? (
            <EmptyState>Aucune publication pour le moment. Soyez le premier à publier !</EmptyState>
          ) : (
            <ul className="space-y-4">
              {feed.posts.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} counts={reactions.counts[post.id] ?? {}} mine={reactions.mine[post.id] ?? null} viewer={viewer} />
                </li>
              ))}
            </ul>
          )}
          <Pager basePath="/communaute" params={tab === 'abonnements' ? { onglet: 'abonnements' } : {}} page={page} hasNext={feed.hasMore} />
        </div>

        <aside aria-label="Communautés">
          <h2 className="mb-3 font-semibold">Communautés</h2>
          <ul className="space-y-1 text-sm">
            {(communities ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/communaute/${c.slug}`} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/5">
                  <span>{c.name}</span>
                  {memberOf.includes(c.id) && <span className="text-xs text-[var(--accent-blue)]">✓</span>}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
