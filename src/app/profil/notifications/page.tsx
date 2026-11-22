import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NotificationPreferences } from '@/components/notification-preferences';
import { Card, PageHeader } from '@/components/ui';
import { fetchGames } from '@/lib/data/catalog';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Préférences de notifications' };

export default async function NotificationPreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/connexion?next=/profil/notifications');

  const [{ games }, prefs] = await Promise.all([
    fetchGames(),
    supabase.from('user_preferences').select('notification_settings').eq('user_id', user.id).maybeSingle<{ notification_settings: { kinds?: Record<string, boolean>; muted_games?: string[] } }>(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <PageHeader title="Préférences de notifications" subtitle="Choisissez ce que vous souhaitez recevoir.">
        <Link href="/notifications" className="text-sm text-[var(--accent-blue)] hover:underline">← Notifications</Link>
      </PageHeader>
      <Card className="p-6">
        <NotificationPreferences initial={prefs.data?.notification_settings ?? {}} games={games.map((g) => ({ id: g.id, name: g.name }))} />
      </Card>
      <p className="mt-4 text-xs text-zinc-500">Les notifications sont délivrées dans le site. Les e-mails et notifications push ne sont pas encore activés.</p>
    </main>
  );
}
