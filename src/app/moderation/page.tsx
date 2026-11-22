import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ModerationActions } from '@/components/moderation-actions';
import { Badge, Card, EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { getViewer } from '@/lib/data/community';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Modération' };

const REASON: Record<string, string> = { spam: 'Spam', harassment: 'Harcèlement', hate: 'Haine ou discrimination', illegal: 'Contenu illégal', other: 'Autre' };
const TYPE: Record<string, string> = { post: 'Publication', comment: 'Commentaire', message: 'Message privé', chat_message: 'Message de chat', profile: 'Profil' };

interface Report {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  reporter: { username: string } | null;
}
interface Preview {
  text: string;
  authorId: string | null;
  href: string | null;
}

export default async function ModerationPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion?next=/moderation');
  if (!viewer.isStaff) notFound();

  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, target_type, target_id, reason, details, created_at, reporter:profiles(username)')
    .eq('status', 'open')
    .order('created_at')
    .limit(50)
    .returns<Report[]>();
  const list = reports ?? [];
  const ids = (type: string) => list.filter((r) => r.target_type === type).map((r) => r.target_id);

  const [posts, comments, chats, messages, profiles] = await Promise.all([
    ids('post').length ? supabase.from('posts').select('id, body, kind, author_id').in('id', ids('post')) : Promise.resolve({ data: [] }),
    ids('comment').length ? supabase.from('comments').select('id, body, author_id, post_id').in('id', ids('comment')) : Promise.resolve({ data: [] }),
    ids('chat_message').length ? supabase.from('chat_messages').select('id, body, user_id, stream_id').in('id', ids('chat_message')) : Promise.resolve({ data: [] }),
    ids('message').length ? supabase.from('messages').select('id, body, sender_id').in('id', ids('message')) : Promise.resolve({ data: [] }),
    ids('profile').length ? supabase.from('profiles').select('id, username').in('id', ids('profile')) : Promise.resolve({ data: [] }),
  ]);

  const previews = new Map<string, Preview>();
  for (const p of (posts.data ?? []) as { id: string; body: string; kind: string; author_id: string }[]) previews.set(`post:${p.id}`, { text: p.body || `(publication de type ${p.kind})`, authorId: p.author_id, href: `/communaute/posts/${p.id}` });
  for (const c of (comments.data ?? []) as { id: string; body: string; author_id: string; post_id: string }[]) previews.set(`comment:${c.id}`, { text: c.body, authorId: c.author_id, href: `/communaute/posts/${c.post_id}` });
  for (const c of (chats.data ?? []) as { id: string; body: string; user_id: string; stream_id: string }[]) previews.set(`chat_message:${c.id}`, { text: c.body, authorId: c.user_id, href: `/live/${c.stream_id}` });
  for (const m of (messages.data ?? []) as { id: string; body: string; sender_id: string }[]) previews.set(`message:${m.id}`, { text: m.body, authorId: m.sender_id, href: null });
  for (const p of (profiles.data ?? []) as { id: string; username: string }[]) previews.set(`profile:${p.id}`, { text: `Profil @${p.username}`, authorId: p.id, href: `/membres/${p.username}` });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Modération" subtitle="Signalements en attente de traitement." />
      {error ? (
        <ErrorState />
      ) : list.length === 0 ? (
        <EmptyState>Aucun signalement en attente.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {list.map((report) => {
            const preview = previews.get(`${report.target_type}:${report.target_id}`);
            return (
              <li key={report.id}>
                <Card className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone="amber">{REASON[report.reason] ?? report.reason}</Badge>
                    <Badge>{TYPE[report.target_type] ?? report.target_type}</Badge>
                    <span className="text-xs text-zinc-500">par {report.reporter?.username ?? 'un membre'} · {formatDateTime(report.created_at)}</span>
                  </div>
                  {preview ? (
                    <blockquote className="whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-zinc-200">{preview.text}</blockquote>
                  ) : (
                    <p className="text-sm text-zinc-500">Le contenu signalé n’existe plus ou n’est plus accessible.</p>
                  )}
                  {report.details && <p className="text-sm text-zinc-400">Précisions : {report.details}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <ModerationActions reportId={report.id} targetType={report.target_type} targetId={report.target_id} authorId={preview?.authorId ?? null} />
                    {preview?.href && <Link href={preview.href} className="text-xs text-[var(--accent-blue)] hover:underline">Voir dans son contexte</Link>}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
