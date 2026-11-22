'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/community-utils';
import { ReportButton } from '@/components/report-button';

interface ChatLine {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}

/** Chat communautaire d'une diffusion (Realtime). Lecture publique ; écriture réservée aux membres connectés. */
export function ChatPanel({ streamId, closed, loggedIn }: { streamId: string; closed: boolean; loggedIn: boolean }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const knownNames = useRef<Set<string>>(new Set());

  async function loadNames(ids: string[]) {
    const missing = ids.filter((id) => !knownNames.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => knownNames.current.add(id));
    const { data } = await createClient().from('profiles').select('id, username').in('id', missing);
    if (data) setNames((prev) => ({ ...prev, ...Object.fromEntries(data.map((p: { id: string; username: string }) => [p.id, p.username])) }));
  }

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
    void supabase
      .from('chat_messages')
      .select('id, user_id, body, created_at')
      .eq('stream_id', streamId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!active || !data) return;
        const ordered = [...(data as ChatLine[])].reverse();
        setLines(ordered);
        void loadNames(ordered.map((l) => l.user_id));
      });

    const channel = supabase
      .channel(`chat-${streamId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `stream_id=eq.${streamId}` }, (payload) => {
        const line = payload.new as ChatLine & { is_hidden?: boolean };
        if (line.is_hidden) return;
        setLines((prev) => (prev.some((l) => l.id === line.id) ? prev : [...prev, line].slice(-200)));
        void loadNames([line.user_id]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `stream_id=eq.${streamId}` }, (payload) => {
        const line = payload.new as ChatLine & { is_hidden?: boolean };
        if (line.is_hidden) setLines((prev) => prev.filter((l) => l.id !== line.id));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        const old = payload.old as { id?: string };
        if (old.id) setLines((prev) => prev.filter((l) => l.id !== old.id));
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body || !meId) return;
    setPending(true);
    setError(null);
    const { error: failure } = await createClient().from('chat_messages').insert({ stream_id: streamId, user_id: meId, body });
    setPending(false);
    if (failure) return setError(friendlyError(failure));
    form.reset();
  }

  return (
    <section aria-label="Chat de la diffusion" className="flex h-[28rem] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <h2 className="border-b border-[var(--border)] px-4 py-3 font-semibold">Chat</h2>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
        {lines.length === 0 && <p className="text-zinc-500">Aucun message pour le moment.</p>}
        {lines.map((line) => (
          <div key={line.id} className="group flex items-start gap-2">
            <p className="min-w-0 flex-1 break-words">
              {names[line.user_id] ? <Link href={`/membres/${names[line.user_id]}`} className="font-medium text-[var(--accent-blue)] hover:underline">{names[line.user_id]}</Link> : <span className="font-medium text-zinc-400">Membre</span>}
              <span className="text-zinc-300">{' '}{line.body}</span>
            </p>
            {meId && meId !== line.user_id && <span className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"><ReportButton targetType="chat_message" targetId={line.id} /></span>}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-[var(--border)] p-3">
        {closed ? (
          <p className="text-sm text-zinc-500">Le chat est fermé : la diffusion est terminée.</p>
        ) : !loggedIn ? (
          <p className="text-sm text-zinc-400"><Link href="/connexion" className="text-[var(--accent-blue)] hover:underline">Connectez-vous</Link> pour participer au chat.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex gap-2">
            <input name="body" maxLength={300} placeholder="Votre message…" aria-label="Votre message" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            <button type="submit" disabled={pending} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium disabled:opacity-60">Envoyer</button>
          </form>
        )}
        {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      </div>
    </section>
  );
}
