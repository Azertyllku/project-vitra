'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/community-utils';

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harcèlement' },
  { value: 'hate', label: 'Haine ou discrimination' },
  { value: 'illegal', label: 'Contenu illégal' },
  { value: 'other', label: 'Autre' },
];

export function ReportButton({ targetType, targetId }: { targetType: 'post' | 'comment' | 'message' | 'chat_message' | 'profile'; targetId: string }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage({ ok: false, text: 'Connectez-vous pour signaler un contenu.' });
      setPending(false);
      return;
    }
    const { error } = await supabase.from('reports').insert({
      reporter_id: auth.user.id,
      target_type: targetType,
      target_id: targetId,
      reason: String(data.get('reason')),
      details: String(data.get('details') ?? '').trim().slice(0, 500) || null,
    });
    setPending(false);
    if (error?.code === '23505') setMessage({ ok: true, text: 'Vous avez déjà signalé ce contenu.' });
    else if (error) setMessage({ ok: false, text: friendlyError(error) });
    else {
      setMessage({ ok: true, text: 'Merci, votre signalement a été transmis à l’équipe de modération.' });
      form.reset();
    }
  }

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-xs text-zinc-500 hover:text-zinc-300">Signaler</summary>
      <form onSubmit={onSubmit} className="absolute left-0 z-20 mt-2 w-64 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
        <select name="reason" aria-label="Motif du signalement" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm">
          {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <textarea name="details" maxLength={500} rows={2} placeholder="Précisions (facultatif)" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm" />
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium disabled:opacity-60">Envoyer</button>
        {message && <p role="status" className={`text-xs ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>}
      </form>
    </details>
  );
}
