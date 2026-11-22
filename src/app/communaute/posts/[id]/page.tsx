import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteCommentButton } from '@/components/comment-actions';
import { PostCard } from '@/components/post-card';
import { CommentForm } from '@/components/post-forms';
import { ReactionBar } from '@/components/reaction-bar';
import { ReportButton } from '@/components/report-button';
import { SectionTitle } from '@/components/ui';
import { fetchComments, fetchPost, fetchReactionData, getViewer, type CommentRow } from '@/lib/data/community';
import { formatDateTime } from '@/lib/format';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchPost(id);
  return { title: post ? `Publication de ${post.author?.username ?? 'un membre'}` : 'Publication introuvable' };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await fetchPost(id);
  if (!post) notFound();

  const viewer = await getViewer();
  const comments = await fetchComments(post.id);
  const [postReactions, commentReactions] = await Promise.all([
    fetchReactionData('post', [post.id], viewer?.id ?? null),
    fetchReactionData('comment', comments.map((c) => c.id), viewer?.id ?? null),
  ]);

  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (parent: string) => comments.filter((c) => c.parent_id === parent);

  const renderComment = (comment: CommentRow, isReply: boolean) => {
    const own = viewer?.id === comment.author_id;
    return (
      <li key={comment.id} className={isReply ? 'ml-6 border-l border-[var(--border)] pl-4' : ''}>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
            {comment.author ? <Link href={`/membres/${comment.author.username}`} className="font-medium hover:text-[var(--accent-blue)]">{comment.author.username}</Link> : <span className="font-medium text-zinc-400">Membre</span>}
            <time className="text-xs text-zinc-500" dateTime={comment.created_at}>{formatDateTime(comment.created_at)}</time>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">{comment.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <ReactionBar targetType="comment" targetId={comment.id} counts={commentReactions.counts[comment.id] ?? {}} mine={commentReactions.mine[comment.id] ?? null} loggedIn={Boolean(viewer)} />
            {viewer && !own && <ReportButton targetType="comment" targetId={comment.id} />}
            {viewer && (own || viewer.isStaff) && <DeleteCommentButton commentId={comment.id} />}
          </div>
          {viewer && !isReply && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-[var(--accent-blue)]">Répondre</summary>
              <div className="mt-2"><CommentForm postId={post.id} parentId={comment.id} compact /></div>
            </details>
          )}
        </div>
        {!isReply && repliesOf(comment.id).length > 0 && <ul className="mt-3 space-y-3">{repliesOf(comment.id).map((reply) => renderComment(reply, true))}</ul>}
      </li>
    );
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-3 text-sm text-zinc-400"><Link href="/communaute" className="hover:text-white">Communauté</Link></p>
      <PostCard post={post} counts={postReactions.counts[post.id] ?? {}} mine={postReactions.mine[post.id] ?? null} viewer={viewer} detail />

      <SectionTitle>Commentaires ({comments.length})</SectionTitle>
      {viewer ? (
        <div className="mb-6"><CommentForm postId={post.id} /></div>
      ) : (
        <p className="mb-6 text-sm text-zinc-400"><Link href={`/connexion?next=/communaute/posts/${post.id}`} className="text-[var(--accent-blue)] hover:underline">Connectez-vous</Link> pour commenter.</p>
      )}
      {top.length === 0 ? <p className="text-sm text-zinc-500">Aucun commentaire pour le moment.</p> : <ul className="space-y-4">{top.map((c) => renderComment(c, false))}</ul>}
    </main>
  );
}
