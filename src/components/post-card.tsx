import Link from 'next/link';
import { CommunityPostActions } from '@/components/post-card-actions';
import { EmbedPlayer } from '@/components/embed-player';
import { ReactionBar } from '@/components/reaction-bar';
import { ReportButton } from '@/components/report-button';
import { Card } from '@/components/ui';
import { fetchPerformance, findPeriod, formatPlaytime, sinceDays, winRate } from '@/lib/data/performance';
import type { PostRow, Viewer } from '@/lib/data/community';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

async function PerformanceBlock({ accountId, period }: { accountId: string; period: string }) {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from('player_game_accounts')
    .select('display_name, provider, game:games(name)')
    .eq('id', accountId)
    .maybeSingle<{ display_name: string | null; provider: string; game: { name: string } | null }>();
  const p = findPeriod(period);
  const perf = account ? await fetchPerformance(accountId, sinceDays(p.days)) : null;

  if (!account || !perf || perf.played === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-zinc-500">Statistiques non disponibles : le compte n’est pas public ou aucune partie n’est enregistrée sur cette période.</p>;
  }
  const rate = winRate(perf);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
      <p className="text-sm font-medium">{account.game?.name}{account.display_name ? ` · ${account.display_name}` : ''} — {p.label}</p>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-sm">
        <div><dt className="text-xs text-zinc-400">Parties</dt><dd className="tabular-nums">{perf.played}</dd></div>
        <div><dt className="text-xs text-zinc-400">Victoires</dt><dd className="tabular-nums">{perf.wins}</dd></div>
        <div><dt className="text-xs text-zinc-400">% victoires</dt><dd className="tabular-nums">{rate != null ? `${rate} %` : '—'}</dd></div>
        <div><dt className="text-xs text-zinc-400">Temps de jeu</dt><dd className="tabular-nums">{formatPlaytime(perf.seconds)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-zinc-500">Données lues en direct depuis le compte (provenance : {Object.keys(perf.by_source).join(', ')}).</p>
    </div>
  );
}

export function PostCard({
  post,
  counts,
  mine,
  viewer,
  detail,
}: {
  post: PostRow;
  counts: Record<string, number>;
  mine: string | null;
  viewer: Viewer | null;
  detail?: boolean;
}) {
  const own = viewer?.id === post.author_id;
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          {post.author ? <Link href={`/membres/${post.author.username}`} className="font-medium hover:text-[var(--accent-blue)]">{post.author.display_name ?? post.author.username}</Link> : <span className="font-medium text-zinc-400">Membre</span>}
          {post.community && <> <span className="text-zinc-500">dans</span> <Link href={`/communaute/${post.community.slug}`} className="text-[var(--accent-blue)] hover:underline">{post.community.name}</Link></>}
        </span>
        <time className="text-xs text-zinc-500" dateTime={post.created_at}>{formatDateTime(post.created_at)}</time>
      </div>

      {post.body && <p className="whitespace-pre-wrap break-words text-zinc-200">{post.body}</p>}

      {post.kind === 'clip' && post.clip_provider && post.clip_ref && (
        <div className="mt-3"><EmbedPlayer provider={post.clip_provider} embedRef={post.clip_ref} title={`Clip de ${post.author?.username ?? 'membre'}`} /></div>
      )}
      {post.kind === 'performance' && post.account_id && post.period && (
        <div className="mt-3"><PerformanceBlock accountId={post.account_id} period={post.period} /></div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <ReactionBar targetType="post" targetId={post.id} counts={counts} mine={mine} loggedIn={Boolean(viewer)} />
        <div className="flex items-center gap-4 text-xs">
          {!detail && <Link href={`/communaute/posts/${post.id}`} className="text-[var(--accent-blue)] hover:underline">Commenter</Link>}
          {viewer && !own && <ReportButton targetType="post" targetId={post.id} />}
          {viewer && (own || viewer.isStaff) && <CommunityPostActions postId={post.id} canDelete={own || viewer.isStaff} canHide={viewer.isStaff && !own} />}
        </div>
      </div>
    </Card>
  );
}
