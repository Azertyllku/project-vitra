'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Rafraîchit la page quand un match change (Supabase Realtime). La RLS s'applique :
 * le navigateur ne reçoit que ce qu'il a le droit de lire.
 * Avec matchId : un seul match (score, événements). Sans : tous les matchs.
 */
export function LiveRefresh({ matchId }: { matchId?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    // Nom de canal unique par montage : évite de récupérer un canal déjà abonné.
    const channel = supabase.channel(`${matchId ? `match-${matchId}` : 'matches-all'}-${Math.random().toString(36).slice(2)}`);
    const refresh = () => router.refresh();

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'matches', ...(matchId ? { filter: `id=eq.${matchId}` } : {}) }, refresh);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'match_teams', ...(matchId ? { filter: `match_id=eq.${matchId}` } : {}) }, refresh);
    if (matchId) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` }, refresh);
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, router]);

  return null;
}
