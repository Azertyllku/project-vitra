'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Rend un compte vérifié visible (ou non) sur le profil joueur public. */
export function AccountVisibilityToggle({ accountId, isPublic }: { accountId: string; isPublic: boolean }) {
  const [value, setValue] = useState(isPublic);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onChange(next: boolean) {
    setPending(true);
    setError(false);
    const { error: failure } = await createClient().from('player_game_accounts').update({ is_public: next }).eq('id', accountId);
    setPending(false);
    if (failure) return setError(true);
    setValue(next);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" checked={value} disabled={pending} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
      Visible sur mon profil public
      {error && <span role="alert" className="text-xs text-red-300">Modification impossible.</span>}
    </label>
  );
}
