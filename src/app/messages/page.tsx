import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TableRefresh } from '@/components/table-refresh';
import { Card, EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Messages' };

interface Conversation {
  partner_id: string;
  partner_username: string;
  last_body: string;
  last_at: string;
  last_from_me: boolean;
  unread: number | string;
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/connexion?next=/messages');

  const { data, error } = await supabase.rpc('my_conversations');
  const conversations = (data ?? []) as Conversation[];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <TableRefresh tables={['messages']} channelName="inbox" />
      <PageHeader title="Messages" subtitle="Vos conversations privées." />
      {error ? (
        <ErrorState />
      ) : conversations.length === 0 ? (
        <EmptyState>Aucune conversation. Pour écrire à quelqu’un, ouvrez son profil depuis la <Link href="/communaute" className="text-[var(--accent-blue)] underline">communauté</Link> et choisissez « Envoyer un message ».</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {conversations.map((c) => (
              <li key={c.partner_id}>
                <Link href={`/messages/${c.partner_id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/5">
                  <span className="min-w-0">
                    <span className="block font-medium">{c.partner_username}</span>
                    <span className="block truncate text-sm text-zinc-400">{c.last_from_me ? 'Vous : ' : ''}{c.last_body}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-zinc-500">
                    {formatDateTime(c.last_at)}
                    {Number(c.unread) > 0 && <span className="ml-2 rounded-full bg-[var(--accent)] px-1.5 py-0.5 font-semibold text-white">{c.unread}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
