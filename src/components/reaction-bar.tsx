'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/community-utils';

const KINDS = [
  { key: 'like', label: '👍' },
  { key: 'gg', label: '🏆 GG' },
  { key: 'fire', label: '🔥' },
  { key: 'laugh', label: '😂' },
] as const;

/** Réactions (une par membre et par contenu). */
export function ReactionBar({
  targetType,
  targetId,
  counts,
  mine,
  loggedIn,
}: {
  targetType: 'post' | 'comment';
  targetId: string;
  counts: Record<string, number>;
  mine: string | null;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(mine);
  const [totals, setTotals] = useState(counts);
  const [error, setError] = useState<string | null>(null);

  async function choose(kind: string) {
    if (!loggedIn) {
      router.push('/connexion');
      return;
    }
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push('/connexion');
      return;
    }
    const next = { ...totals };
    if (current === kind) {
      const { error: failure } = await supabase.from('reactions').delete().eq('user_id', data.user.id).eq('target_type', targetType).eq('target_id', targetId);
      if (failure) return setError(friendlyError(failure));
      next[kind] = Math.max((next[kind] ?? 1) - 1, 0);
      setCurrent(null);
    } else {
      const { error: failure } = await supabase
        .from('reactions')
        .upsert({ user_id: data.user.id, target_type: targetType, target_id: targetId, kind }, { onConflict: 'user_id,target_type,target_id' });
      if (failure) return setError(friendlyError(failure));
      if (current) next[current] = Math.max((next[current] ?? 1) - 1, 0);
      next[kind] = (next[kind] ?? 0) + 1;
      setCurrent(kind);
    }
    setTotals(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {KINDS.map((k) => (
        <button
          key={k.key}
          type="button"
          onClick={() => choose(k.key)}
          aria-pressed={current === k.key}
          className={`rounded-full border px-2.5 py-1 text-xs transition ${current === k.key ? 'border-[var(--accent)] bg-[var(--accent)]/20' : 'border-[var(--border)] hover:bg-white/5'}`}
        >
          {k.label} {totals[k.key] ? totals[k.key] : ''}
        </button>
      ))}
      {error && <span role="alert" className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
