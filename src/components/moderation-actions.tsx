'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const btn = 'rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-60';

/** Actions de modération sur un signalement (réservées au staff ; la base refuse tout autre appelant). */
export function ModerationActions({
  reportId,
  targetType,
  targetId,
  authorId,
}: {
  reportId: string;
  targetType: string;
  targetId: string;
  authorId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function closeReport(status: 'dismissed' | 'actioned') {
    const { data } = await supabase.auth.getUser();
    const { error: failure } = await supabase.from('reports').update({ status, reviewed_by: data.user?.id ?? null, reviewed_at: new Date().toISOString() }).eq('id', reportId);
    if (failure) throw failure;
  }

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch {
      setError('Action refusée ou impossible.');
    }
    setPending(false);
  }

  const hideTable = targetType === 'post' ? 'posts' : targetType === 'comment' ? 'comments' : targetType === 'chat_message' ? 'chat_messages' : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hideTable && (
        <button type="button" disabled={pending} className={btn} onClick={() => run(async () => {
          const { error: failure } = await supabase.from(hideTable).update({ is_hidden: true }).eq('id', targetId);
          if (failure) throw failure;
          await closeReport('actioned');
        })}>Masquer le contenu</button>
      )}
      {authorId && (
        <button type="button" disabled={pending} className={btn} onClick={() => run(async () => {
          if (!window.confirm('Mettre cet auteur en sourdine pendant 24 h ?')) return;
          const { data } = await supabase.auth.getUser();
          const until = new Date(Date.now() + 24 * 3600_000).toISOString();
          const { error: failure } = await supabase.from('user_sanctions').insert({ user_id: authorId, kind: 'mute', reason: `Signalement ${reportId}`, until, created_by: data.user?.id ?? null });
          if (failure) throw failure;
          await closeReport('actioned');
        })}>Sourdine 24 h</button>
      )}
      <button type="button" disabled={pending} className={btn} onClick={() => run(() => closeReport('dismissed'))}>Rejeter</button>
      {error && <span role="alert" className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
