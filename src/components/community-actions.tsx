'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/community-utils';

const ghost = 'rounded-lg border border-[var(--border)] px-4 py-2 text-sm transition hover:bg-white/5 disabled:opacity-60';

function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  return async () => {
    const { data } = await createClient().auth.getUser();
    if (!data.user) router.push(`/connexion?next=${encodeURIComponent(pathname)}`);
    return data.user?.id ?? null;
  };
}

export function FollowButton({ targetId, initial }: { targetId: string; initial: boolean }) {
  const router = useRouter();
  const guard = useAuthGuard();
  const [active, setActive] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    const userId = await guard();
    if (!userId) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: failure } = active
      ? await supabase.from('follows').delete().eq('follower_id', userId).eq('followed_id', targetId)
      : await supabase.from('follows').insert({ follower_id: userId, followed_id: targetId });
    setPending(false);
    if (failure) return setError(friendlyError(failure));
    setActive(!active);
    router.refresh();
  }

  return (
    <span>
      <button type="button" onClick={onClick} disabled={pending} aria-pressed={active} className={`${ghost} ${active ? 'border-[var(--accent)] bg-[var(--accent)]/20' : ''}`}>
        {active ? 'Abonné' : 'S’abonner'}
      </button>
      {error && <span role="alert" className="ml-2 text-xs text-red-300">{error}</span>}
    </span>
  );
}

export function JoinCommunityButton({ communityId, initial }: { communityId: string; initial: boolean }) {
  const router = useRouter();
  const guard = useAuthGuard();
  const [active, setActive] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    const userId = await guard();
    if (!userId) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: failure } = active
      ? await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId)
      : await supabase.from('community_members').insert({ community_id: communityId, user_id: userId });
    setPending(false);
    if (failure) return setError(friendlyError(failure));
    setActive(!active);
    router.refresh();
  }

  return (
    <span>
      <button type="button" onClick={onClick} disabled={pending} aria-pressed={active} className={`${ghost} ${active ? 'border-[var(--accent)] bg-[var(--accent)]/20' : ''}`}>
        {active ? 'Membre ✓' : 'Rejoindre'}
      </button>
      {error && <span role="alert" className="ml-2 text-xs text-red-300">{error}</span>}
    </span>
  );
}

export function BlockButton({ targetId, initial }: { targetId: string; initial: boolean }) {
  const router = useRouter();
  const guard = useAuthGuard();
  const [active, setActive] = useState(initial);
  const [pending, setPending] = useState(false);

  async function onClick() {
    const userId = await guard();
    if (!userId) return;
    if (!active && !window.confirm('Bloquer ce membre ? Il ne pourra plus vous envoyer de messages ni s’abonner à vous.')) return;
    setPending(true);
    const supabase = createClient();
    if (active) await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', targetId);
    else await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: targetId });
    setPending(false);
    setActive(!active);
    router.refresh();
  }

  return <button type="button" onClick={onClick} disabled={pending} className={ghost}>{active ? 'Débloquer' : 'Bloquer'}</button>;
}

export function PostActions({ postId, canDelete, canHide }: { postId: string; canDelete: boolean; canHide: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!window.confirm('Supprimer cette publication ? Cette action est définitive.')) return;
    setPending(true);
    await createClient().from('posts').delete().eq('id', postId);
    router.push('/communaute');
    router.refresh();
  }
  async function hide() {
    if (!window.confirm('Masquer cette publication pour tous les membres ?')) return;
    setPending(true);
    await createClient().from('posts').update({ is_hidden: true }).eq('id', postId);
    router.refresh();
  }

  return (
    <span className="flex items-center gap-3 text-xs text-zinc-500">
      {canDelete && <button type="button" onClick={remove} disabled={pending} className="hover:text-red-300">Supprimer</button>}
      {canHide && <button type="button" onClick={hide} disabled={pending} className="hover:text-amber-300">Masquer (modération)</button>}
    </span>
  );
}
