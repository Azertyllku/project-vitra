'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface DashboardConfig {
  hidden?: string[];
  default_period?: string;
}

/** Personnalisation du tableau de bord (Premium) : sections affichées et période par défaut. */
export function DashboardCustomizer({
  initial,
  sections,
  periods,
}: {
  initial: DashboardConfig;
  sections: { key: string; label: string }[];
  periods: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>(initial.hidden ?? []);
  const [period, setPeriod] = useState(initial.default_period ?? '30j');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setPending(false);
      return setMessage({ ok: false, text: 'Connexion requise.' });
    }
    const { error } = await supabase
      .from('user_dashboards')
      .upsert({ user_id: data.user.id, config: { hidden, default_period: period }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setPending(false);
    if (error) return setMessage({ ok: false, text: 'Enregistrement impossible, réessayez.' });
    setMessage({ ok: true, text: 'Tableau de bord enregistré.' });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Sections affichées</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.key}>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={!hidden.includes(s.key)} onChange={(e) => setHidden(e.target.checked ? hidden.filter((k) => k !== s.key) : [...hidden, s.key])} className="h-4 w-4 accent-[var(--accent)]" />
                {s.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Période par défaut</span>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
          {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium disabled:opacity-60">Enregistrer</button>
        {message && <span role="status" className={`text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</span>}
      </div>
    </div>
  );
}
