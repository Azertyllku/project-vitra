'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError, parseClip } from '@/lib/community-utils';

const input = 'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]';
const PERIODS = [
  { key: '7j', label: '7 jours' },
  { key: '30j', label: '30 jours' },
  { key: '90j', label: '90 jours' },
  { key: '6m', label: '6 mois' },
  { key: '1a', label: '1 an' },
  { key: 'carriere', label: 'Carrière' },
];

type Mode = 'text' | 'clip' | 'performance';

export function PostComposer({ communityId, accounts }: { communityId?: string; accounts: { id: string; label: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('text');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get('body') ?? '').trim();
    const base: Record<string, unknown> = { community_id: communityId ?? null, kind: mode, body };

    if (mode === 'text' && body.length < 1) return setError('Écrivez quelque chose avant de publier.');
    if (mode === 'clip') {
      const clip = parseClip(String(data.get('clip_url') ?? ''));
      if (!clip) return setError('Lien non reconnu : collez un lien YouTube ou un clip Twitch.');
      base.clip_provider = clip.provider;
      base.clip_ref = clip.ref;
    }
    if (mode === 'performance') {
      const accountId = String(data.get('account_id') ?? '');
      if (!accountId) return setError('Choisissez un compte de jeu à partager.');
      base.account_id = accountId;
      base.period = String(data.get('period'));
    }

    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push('/connexion?next=/communaute');
      return;
    }
    const { error: failure } = await supabase.from('posts').insert({ ...base, author_id: auth.user.id });
    setPending(false);
    if (failure) return setError(friendlyError(failure));
    form.reset();
    router.refresh();
  }

  const tab = (key: Mode, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => { setMode(key); setError(null); }}
      aria-pressed={mode === key}
      className={`rounded-full border px-3 py-1 text-sm ${mode === key ? 'border-[var(--accent)] bg-[var(--accent)]/20' : 'border-[var(--border)] text-zinc-400 hover:text-white'}`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div className="flex flex-wrap gap-2">
        {tab('text', 'Message')}
        {tab('clip', 'Clip')}
        {accounts.length > 0 && tab('performance', 'Mes performances')}
      </div>
      <textarea name="body" maxLength={2000} rows={mode === 'text' ? 4 : 2} placeholder={mode === 'text' ? 'Partagez quelque chose avec la communauté…' : 'Un commentaire (facultatif)'} className={input} />
      {mode === 'clip' && <input name="clip_url" placeholder="Lien d’un clip YouTube ou Twitch" className={input} />}
      {mode === 'performance' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="account_id" aria-label="Compte de jeu" className={input}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <select name="period" defaultValue="30j" aria-label="Période" className={input}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <p className="text-xs text-zinc-500 sm:col-span-2">Les statistiques sont lues en direct depuis votre compte : seuls les comptes vérifiés et publics sont visibles par les autres membres.</p>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60">{pending ? 'Publication…' : 'Publier'}</button>
    </form>
  );
}

export function CommentForm({ postId, parentId, compact }: { postId: string; parentId?: string; compact?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (body.length < 1) return setError('Écrivez un commentaire.');
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push(`/connexion?next=/communaute/posts/${postId}`);
      return;
    }
    const { error: failure } = await supabase.from('comments').insert({ post_id: postId, author_id: auth.user.id, parent_id: parentId ?? null, body });
    setPending(false);
    if (failure) return setError(friendlyError(failure));
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <textarea name="body" maxLength={1000} rows={compact ? 2 : 3} placeholder={parentId ? 'Votre réponse…' : 'Votre commentaire…'} aria-label={parentId ? 'Répondre' : 'Commenter'} className={input} />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium disabled:opacity-60">{parentId ? 'Répondre' : 'Commenter'}</button>
    </form>
  );
}
