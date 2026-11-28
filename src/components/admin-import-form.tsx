'use client';

import { useActionState, useState } from 'react';
import { importCsv } from '@/app/admin/import/actions';
import { IMPORT_KINDS, type ImportState } from '@/lib/admin/import-types';

const initial: ImportState = { ok: false, message: null, dryRun: true, total: 0, processed: 0, ignored: 0, issues: [] };
const field = 'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:border-[var(--accent)]';

export function AdminImportForm() {
  const [state, action, pending] = useActionState(importCsv, initial);
  const [kind, setKind] = useState('equipes');
  const [dry, setDry] = useState(true);
  const [csv, setCsv] = useState('');
  const meta = IMPORT_KINDS[kind];

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_500_000) return window.alert('Fichier trop volumineux (1,5 Mo maximum).');
    setCsv(await file.text());
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-300">Type de données</span>
          <select name="kind" value={kind} onChange={(event) => setKind(event.target.value)} className={field}>
            {Object.entries(IMPORT_KINDS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-300">Provenance des données</span>
          <select name="provenance" defaultValue="imported" className={field}>
            <option value="imported">Import (données issues d’une source externe)</option>
            <option value="manual">Saisie manuelle (données relevées à la main)</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-300">Source des données <span className="text-[var(--accent)]">*</span></span>
        <input name="source" required maxLength={200} placeholder="Ex. site officiel de l’organisateur, Liquipedia (CC BY-SA), API …" className={field} />
        <span className="mt-1 block text-xs text-zinc-500">Inscrite dans le journal d’administration. Citez toujours d’où viennent les données.</span>
      </label>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <p className="text-zinc-300">{meta.description}</p>
        <p className="mt-2 text-xs text-zinc-500">Colonnes : {meta.columns.join(', ')}</p>
        <button type="button" onClick={() => setCsv(meta.template)} className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-white/5">
          Insérer le modèle (à remplacer)
        </button>
      </div>

      <div>
        <label className="mb-1 block text-sm text-zinc-300" htmlFor="csv-file">Fichier CSV</label>
        <input id="csv-file" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => onFile(event.target.files?.[0])} className="text-sm" />
        <label className="mb-1 mt-4 block text-sm text-zinc-300" htmlFor="csv-text">ou contenu CSV</label>
        <textarea id="csv-text" name="csv" value={csv} onChange={(event) => setCsv(event.target.value)} rows={12} spellCheck={false} className={`${field} font-mono text-xs`} />
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input type="hidden" name="dry" value="off" />
        <input type="checkbox" name="dry" value="on" checked={dry} onChange={(event) => setDry(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        Simulation seulement (vérifie le fichier sans rien enregistrer)
      </label>

      <button type="submit" disabled={pending} className="rounded-lg bg-[var(--accent)] px-5 py-2 font-medium hover:brightness-110 disabled:opacity-60">
        {pending ? 'Traitement…' : dry ? 'Vérifier le fichier' : 'Importer'}
      </button>

      {state.message && (
        <div role={state.ok ? 'status' : 'alert'} className={`rounded-lg border px-4 py-3 text-sm ${state.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'}`}>
          <p>{state.message}</p>
          {state.total > 0 && <p className="mt-1 text-xs opacity-80">{state.total} ligne(s) lue(s){state.ignored > 0 ? ` · ${state.ignored} déjà présente(s), ignorée(s)` : ''}.</p>}
          {state.issues.length > 0 && (
            <ul className="mt-3 max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
              {state.issues.map((issue, index) => <li key={index}>{issue.line > 0 ? `Ligne ${issue.line} : ` : ''}{issue.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
