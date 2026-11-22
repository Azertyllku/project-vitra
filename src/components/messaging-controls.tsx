'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/community-utils';

export function MessageComposer({ recipientId }: { recipientId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push('/connexion');
      return;
    }
    const { error: failure } = await supabase.from('messages').insert({ sender_id: data.user.id, recipient_id: recipientId, body });
    setPending(false);
    if (failure) return setError(failure.message.includes('row-level security') ? 'Message impossible : ce membre ne peut pas recevoir de message de votre part.' : friendlyError(failure));
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <textarea name="body" maxLength={2000} rows={3} placeholder="Votre message…" aria-label="Votre message" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium disabled:opacity-60">Envoyer</button>
    </form>
  );
}

/** Marque comme lus les messages reçus du correspondant dès l'ouverture de la conversation. */
export function MarkMessagesRead({ partnerId }: { partnerId: string }) {
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      void supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', data.user.id).eq('sender_id', partnerId).is('read_at', null);
    });
  }, [partnerId]);
  return null;
}

export function MarkAllNotificationsRead() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function onClick() {
    setPending(true);
    await createClient().from('user_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    setPending(false);
    router.refresh();
  }
  return <button type="button" onClick={onClick} disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-60">Tout marquer comme lu</button>;
}

export function NotificationLink({ id, href, unread, children }: { id: string; href: string | null; unread: boolean; children: React.ReactNode }) {
  const router = useRouter();
  async function open() {
    if (unread) await createClient().from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (href) router.push(href);
    else router.refresh();
  }
  return (
    <button type="button" onClick={open} className={`block w-full px-4 py-3 text-left transition hover:bg-white/5 ${unread ? 'border-l-2 border-[var(--accent)]' : 'opacity-70'}`}>
      {children}
    </button>
  );
}
