'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const btn = 'rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-60';

export function CreatePlaylistForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name') ?? '').trim();
    if (name.length < 1 || name.length > 80) {
      setError('Le nom doit contenir entre 1 et 80 caractères.');
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push('/connexion?next=/profil/videos');
      return;
    }
    const { error: failure } = await supabase.from('playlists').insert({ user_id: data.user.id, name });
    setPending(false);
    if (failure) {
      setError('Création impossible, réessayez.');
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-2">
      <input
        name="name"
        maxLength={80}
        placeholder="Nom de la playlist"
        aria-label="Nom de la playlist"
        className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--accent)]"
      />
      <button type="submit" disabled={pending} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium disabled:opacity-60">
        Créer
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}

export function DeletePlaylistButton({ playlistId, name }: { playlistId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function onClick() {
    if (!window.confirm(`Supprimer la playlist « ${name} » ? Cette action est définitive.`)) return;
    setPending(true);
    await createClient().from('playlists').delete().eq('id', playlistId);
    router.refresh();
  }
  return (
    <button type="button" onClick={onClick} disabled={pending} className={btn}>
      Supprimer
    </button>
  );
}

export function RemoveItemButton({ playlistId, vodId }: { playlistId: string; vodId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function onClick() {
    setPending(true);
    await createClient().from('playlist_items').delete().eq('playlist_id', playlistId).eq('vod_id', vodId);
    router.refresh();
  }
  return (
    <button type="button" onClick={onClick} disabled={pending} className="text-xs text-zinc-400 hover:text-red-300 disabled:opacity-60">
      Retirer
    </button>
  );
}

export function AddToPlaylist({ vodId, playlists }: { vodId: string; playlists: { id: string; name: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(playlists[0]?.id ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (!selected) return;
    setPending(true);
    setMessage(null);
    const { error } = await createClient().from('playlist_items').insert({ playlist_id: selected, vod_id: vodId });
    setPending(false);
    // 23505 = déjà présente dans la playlist
    if (error && error.code !== '23505') setMessage('Ajout impossible, réessayez.');
    else {
      setMessage(error ? 'Déjà dans cette playlist.' : 'Ajoutée à la playlist.');
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        aria-label="Choisir une playlist"
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
      >
        {playlists.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={onClick} disabled={pending} className={btn}>
        Ajouter à la playlist
      </button>
      {message && (
        <span role="status" className="text-sm text-zinc-400">
          {message}
        </span>
      )}
    </div>
  );
}
