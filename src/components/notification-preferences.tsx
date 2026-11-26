'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const NOTIFICATION_KINDS: { key: string; label: string }[] = [
  { key: 'comment', label: 'Commentaire sur une de mes publications' },
  { key: 'reply', label: 'Réponse à un de mes commentaires' },
  { key: 'reaction', label: 'Réaction à un de mes contenus' },
  { key: 'follow', label: 'Nouvel abonné' },
  { key: 'message', label: 'Nouveau message privé' },
  { key: 'match_live', label: 'Un match que je suis passe en direct' },
  { key: 'new_vod', label: 'Nouvelle rediffusion disponible' },
  { key: 'streak', label: 'Série de victoires ou de défaites sur mes comptes' },
];

interface Settings {
  kinds?: Record<string, boolean>;
  muted_games?: string[];
}

export function NotificationPreferences({ initial, games }: { initial: Settings; games: { id: string; name: string }[] }) {
  const [kinds, setKinds] = useState<Record<string, boolean>>(initial.kinds ?? {});
  const [muted, setMuted] = useState<string[]>(initial.muted_games ?? []);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setPending(false);
      return setMessage({ ok: false, text: 'Connexion requise.' });
    }
    // Fusionne avec les réglages existants (autres clés conservées).
    const { data: current } = await supabase.from('user_preferences').select('notification_settings').eq('user_id', data.user.id).maybeSingle();
    const merged = { ...((current?.notification_settings as Record<string, unknown>) ?? {}), kinds, muted_games: muted };
    const { error } = await supabase.from('user_preferences').update({ notification_settings: merged }).eq('user_id', data.user.id);
    setPending(false);
    setMessage(error ? { ok: false, text: 'Enregistrement impossible, réessayez.' } : { ok: true, text: 'Préférences enregistrées.' });
  }

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 font-semibold">Types de notifications</legend>
        <ul className="space-y-2">
          {NOTIFICATION_KINDS.map((k) => (
            <li key={k.key}>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={kinds[k.key] !== false} onChange={(e) => setKinds({ ...kinds, [k.key]: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                {k.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <fieldset>
        <legend className="mb-1 font-semibold">Jeux mis en sourdine</legend>
        <p className="mb-3 text-xs text-zinc-500">Aucune notification de match, de rediffusion ou de série pour les jeux cochés.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {games.map((g) => (
            <li key={g.id}>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={muted.includes(g.id)} onChange={(e) => setMuted(e.target.checked ? [...muted, g.id] : muted.filter((id) => id !== g.id))} className="h-4 w-4 accent-[var(--accent)]" />
                {g.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium disabled:opacity-60">Enregistrer</button>
        {message && <span role="status" className={`text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</span>}
      </div>
    </div>
  );
}
