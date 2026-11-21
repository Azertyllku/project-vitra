'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Enregistre l'ouverture d'une rediffusion dans l'historique du membre connecté (sans écraser sa progression). */
export function ViewTracker({ vodId }: { vodId: string }) {
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      void supabase
        .from('video_views')
        .upsert({ user_id: data.user.id, vod_id: vodId, last_watched_at: new Date().toISOString() }, { onConflict: 'user_id,vod_id' });
    });
  }, [vodId]);
  return null;
}
