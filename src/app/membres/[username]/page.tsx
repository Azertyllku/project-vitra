import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlockButton, FollowButton } from '@/components/community-actions';
import { PostCard } from '@/components/post-card';
import { PublicPerformance } from '@/components/public-performance';
import { ReportButton } from '@/components/report-button';
import { EmptyState, SectionTitle } from '@/components/ui';
import { fetchPosts, fetchReactionData, getViewer } from '@/lib/data/community';
import { flag, formatDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ username: string }> };
interface Member {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  country_code: string | null;
  esport_id: string;
  created_at: string;
}

async function loadMember(username: string): Promise<Member | null> {
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('id, username, display_name, bio, country_code, esport_id, created_at').eq('username', username).maybeSingle<Member>();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const member = await loadMember(username);
  return { title: member ? (member.display_name ?? member.username) : 'Membre introuvable', description: member?.bio ?? undefined };
}

export default async function MemberPage({ params }: Props) {
  const { username } = await params;
  const member = await loadMember(username);
  if (!member) notFound();

  const viewer = await getViewer();
  const supabase = await createClient();
  const isSelf = viewer?.id === member.id;

  const [followers, following, isFollowing, isBlocked, player, feed] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followed_id', member.id),
    supabase.from('follows').select('followed_id', { count: 'exact', head: true }).eq('follower_id', member.id),
    viewer && !isSelf ? supabase.from('follows').select('follower_id').eq('follower_id', viewer.id).eq('followed_id', member.id).maybeSingle() : Promise.resolve({ data: null }),
    viewer && !isSelf ? supabase.from('user_blocks').select('blocked_id').eq('blocker_id', viewer.id).eq('blocked_id', member.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('players').select('slug').eq('profile_id', member.id).maybeSingle<{ slug: string }>(),
    fetchPosts({ authorId: member.id, limit: 10 }),
  ]);
  const reactions = await fetchReactionData('post', feed.posts.map((p) => p.id), viewer?.id ?? null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <h1 className="text-3xl font-bold">{flag(member.country_code)} {member.display_name ?? member.username}</h1>
        <p className="text-zinc-400">@{member.username} · <span className="font-mono">{member.esport_id}</span></p>
        {member.bio && <p className="mt-3 max-w-2xl text-zinc-300">{member.bio}</p>}
        <p className="mt-3 text-sm text-zinc-400">{followers.count ?? 0} abonné{(followers.count ?? 0) > 1 ? 's' : ''} · {following.count ?? 0} abonnement{(following.count ?? 0) > 1 ? 's' : ''} · membre depuis le {formatDate(member.created_at)}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {isSelf ? (
            <Link href="/profil" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-white/5">Mon profil</Link>
          ) : (
            <>
              <FollowButton targetId={member.id} initial={Boolean(isFollowing.data)} />
              {viewer && <Link href={`/messages/${member.id}`} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-white/5">Envoyer un message</Link>}
              {viewer && <BlockButton targetId={member.id} initial={Boolean(isBlocked.data)} />}
              {viewer && <ReportButton targetType="profile" targetId={member.id} />}
            </>
          )}
          {player.data && <Link href={`/joueurs/${player.data.slug}`} className="text-sm text-[var(--accent-blue)] hover:underline">Profil joueur</Link>}
        </div>
      </header>

      <PublicPerformance profileId={member.id} />

      <SectionTitle>Publications</SectionTitle>
      {feed.posts.length === 0 ? (
        <EmptyState>Aucune publication.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {feed.posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} counts={reactions.counts[post.id] ?? {}} mine={reactions.mine[post.id] ?? null} viewer={viewer} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
