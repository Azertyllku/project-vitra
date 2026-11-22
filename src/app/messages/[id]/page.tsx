import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BlockButton } from '@/components/community-actions';
import { MarkMessagesRead, MessageComposer } from '@/components/messaging-controls';
import { ReportButton } from '@/components/report-button';
import { TableRefresh } from '@/components/table-refresh';
import { Card, EmptyState } from '@/components/ui';
import { isUuid } from '@/lib/data/community';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Conversation' };

type Props = { params: Promise<{ id: string }> };
interface Msg {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?next=/messages/${id}`);
  if (user.id === id) notFound();

  const [partner, blocked, messages] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', id).maybeSingle<{ username: string }>(),
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', id).maybeSingle(),
    supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${id}),and(sender_id.eq.${id},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: false })
      .limit(200)
      .returns<Msg[]>(),
  ]);
  const thread = [...(messages.data ?? [])].reverse();
  const name = partner.data?.username ?? 'Membre';

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <TableRefresh tables={['messages']} channelName={`dm-${id}`} />
      <MarkMessagesRead partnerId={id} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400"><Link href="/messages" className="hover:text-white">← Messages</Link></p>
          <h1 className="text-2xl font-bold">{partner.data ? <Link href={`/membres/${name}`} className="hover:text-[var(--accent-blue)]">{name}</Link> : name}</h1>
        </div>
        <BlockButton targetId={id} initial={Boolean(blocked.data)} />
      </div>

      {thread.length === 0 ? (
        <EmptyState>Aucun message. Écrivez le premier !</EmptyState>
      ) : (
        <ul className="mb-6 space-y-3">
          {thread.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <li key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                <Card className={`max-w-[85%] px-4 py-2 ${mine ? 'border-[var(--accent)]/50' : ''}`}>
                  <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                  <p className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    {formatDateTime(m.created_at)}
                    {!mine && <ReportButton targetType="message" targetId={m.id} />}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <MessageComposer recipientId={id} />
    </main>
  );
}
