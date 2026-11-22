import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MarkAllNotificationsRead, NotificationLink } from '@/components/messaging-controls';
import { Card, EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Notifications' };

interface Notification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/connexion?next=/notifications');

  const { data, error } = await supabase
    .from('user_notifications')
    .select('id, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<Notification[]>();
  const items = data ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <PageHeader title="Notifications" subtitle="Ce qui s’est passé depuis votre dernière visite.">
        <span className="flex items-center gap-3">
          <Link href="/profil/notifications" className="text-sm text-[var(--accent-blue)] hover:underline">Préférences</Link>
          {items.some((n) => !n.read_at) && <MarkAllNotificationsRead />}
        </span>
      </PageHeader>
      {error ? (
        <ErrorState />
      ) : items.length === 0 ? (
        <EmptyState>Aucune notification pour le moment.</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationLink id={n.id} href={n.link} unread={!n.read_at}>
                  <span className="block font-medium">{n.title}</span>
                  {n.body && <span className="block truncate text-sm text-zinc-400">{n.body}</span>}
                  <span className="mt-1 block text-xs text-zinc-500">{formatDateTime(n.created_at)}</span>
                </NotificationLink>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
