'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function onClick() {
    if (!window.confirm('Supprimer ce commentaire ? Les réponses associées seront supprimées aussi.')) return;
    setPending(true);
    await createClient().from('comments').delete().eq('id', commentId);
    router.refresh();
  }
  return <button type="button" onClick={onClick} disabled={pending} className="text-xs text-zinc-500 hover:text-red-300 disabled:opacity-60">Supprimer</button>;
}
