'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type EntityType = 'game' | 'player' | 'team' | 'tournament' | 'match';

function Toggle({
  initial,
  loggedIn,
  labelOff,
  labelOn,
  onAdd,
  onRemove,
}: {
  initial: boolean;
  loggedIn: boolean;
  labelOff: string;
  labelOn: string;
  onAdd: (userId: string) => PromiseLike<{ error: unknown }>;
  onRemove: (userId: string) => PromiseLike<{ error: unknown }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onClick() {
    if (!loggedIn) {
      router.push(`/connexion?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setPending(true);
    setError(false);
    const { data } = await createClient().auth.getUser();
    if (!data.user) {
      router.push(`/connexion?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const { error: failure } = active ? await onRemove(data.user.id) : await onAdd(data.user.id);
    if (failure) setError(true);
    else setActive(!active);
    setPending(false);
  }

  return (
    <span>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={active}
        className={`rounded-lg border px-4 py-2 text-sm transition disabled:opacity-60 ${
          active ? 'border-[var(--accent)] bg-[var(--accent)]/20' : 'border-[var(--border)] hover:bg-white/5'
        }`}
      >
        {active ? labelOn : labelOff}
      </button>
      {error && (
        <span role="alert" className="ml-3 text-sm text-red-300">
          Action impossible, réessayez.
        </span>
      )}
    </span>
  );
}

/** Suivre / ne plus suivre un jeu, joueur, équipe, tournoi ou match. */
export function FavoriteButton({
  entityType,
  entityId,
  initial,
  loggedIn,
  labelOff = 'Suivre',
  labelOn = 'Suivi',
}: {
  entityType: EntityType;
  entityId: string;
  initial: boolean;
  loggedIn: boolean;
  labelOff?: string;
  labelOn?: string;
}) {
  const supabase = createClient();
  return (
    <Toggle
      initial={initial}
      loggedIn={loggedIn}
      labelOff={labelOff}
      labelOn={labelOn}
      onAdd={(userId) => supabase.from('user_favorites').insert({ user_id: userId, entity_type: entityType, entity_id: entityId })}
      onRemove={(userId) => supabase.from('user_favorites').delete().eq('user_id', userId).eq('entity_type', entityType).eq('entity_id', entityId)}
    />
  );
}

/** Favori de rediffusion. */
export function VodFavoriteButton({ vodId, initial, loggedIn }: { vodId: string; initial: boolean; loggedIn: boolean }) {
  const supabase = createClient();
  return (
    <Toggle
      initial={initial}
      loggedIn={loggedIn}
      labelOff="Ajouter aux favoris"
      labelOn="Dans mes favoris"
      onAdd={(userId) => supabase.from('video_favorites').insert({ user_id: userId, vod_id: vodId })}
      onRemove={(userId) => supabase.from('video_favorites').delete().eq('user_id', userId).eq('vod_id', vodId)}
    />
  );
}
