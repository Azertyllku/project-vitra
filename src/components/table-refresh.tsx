'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Rafraîchit la page quand les tables listées changent (Supabase Realtime, RLS appliquée). */
export function TableRefresh({ tables, channelName }: { tables: string[]; channelName: string }) {
  const router = useRouter();
  const key = tables.join(',');

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(channelName);
    key.split(',').forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => router.refresh());
    });
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [key, channelName, router]);

  return null;
}
