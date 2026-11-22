'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

/** Cloche de notifications : compteur de non lues mis à jour en temps réel. */
export function NotificationBell({ userId, initialCount }: { userId: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createClient();
    const refresh = async () => {
      const { count: unread } = await supabase.from('user_notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      setCount(unread ?? 0);
    };
    // Nom de canal unique par montage : évite de récupérer un canal déjà abonné (double exécution des effets en développement).
    const channel = supabase
      .channel(`bell-${userId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link href="/notifications" aria-label={count > 0 ? `Notifications : ${count} non lue${count > 1 ? 's' : ''}` : 'Notifications'} className="relative hover:text-[var(--accent-blue)]">
      Notifications
      {count > 0 && <span className="ml-1.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-xs font-semibold text-white">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
