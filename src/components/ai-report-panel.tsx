'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { readFunctionError } from '@/lib/function-error';
import type { AiReport } from '@/lib/data/ai';

const KIND_LABEL = { performance: 'rapport de performances', match: 'résumé du match', tournament: 'résumé du tournoi' } as const;

/** Génère et affiche des rapports IA (membres connectés). Chaque rapport indique sa provenance : règles ou modèle d'IA. */
export function AiReportPanel({
  kind,
  targetId,
  period,
  initial,
  loggedIn,
}: {
  kind: 'performance' | 'match' | 'tournament';
  targetId: string;
  period?: string;
  initial: AiReport[];
  loggedIn: boolean;
}) {
  const [reports, setReports] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return <p className="text-sm text-zinc-400"><Link href="/connexion" className="text-[var(--accent-blue)] hover:underline">Connectez-vous</Link> pour accéder aux rapports IA.</p>;
  }

  async function generate() {
    setPending(true);
    setError(null);
    const body: Record<string, unknown> = { kind, period };
    body[kind === 'performance' ? 'account_id' : kind === 'match' ? 'match_id' : 'tournament_id'] = targetId;
    const { data, error: failure } = await createClient().functions.invoke('ai-report', { body });
    setPending(false);
    if (failure) return setError(await readFunctionError(failure));
    const report = data?.report as AiReport | undefined;
    if (!report) return setError('Réponse inattendue du service.');
    setReports((previous) => [report, ...previous.filter((r) => r.id !== report.id)].slice(0, 3));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={generate} disabled={pending} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:brightness-110 disabled:opacity-60">
          {pending ? 'Génération…' : `Générer un ${KIND_LABEL[kind]}`}
        </button>
        <span className="text-xs text-zinc-500">Fondé uniquement sur les données enregistrées sur ESPORT HUB.</span>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      {reports.length === 0 && !error && <p className="text-sm text-zinc-500">Aucun rapport généré pour le moment.</p>}
      {reports.map((report) => (
        <article key={report.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className={`rounded-full border px-2 py-0.5 ${report.provider === 'anthropic' ? 'border-violet-500/50 bg-violet-500/10 text-violet-200' : 'border-[var(--border)]'}`}>
              {report.provider === 'anthropic' ? `Généré par IA${report.model ? ` · ${report.model}` : ''}` : 'Rapport automatique (règles)'}
            </span>
            <time dateTime={report.created_at}>{new Date(report.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</time>
          </p>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">{report.content}</p>
        </article>
      ))}
    </div>
  );
}
