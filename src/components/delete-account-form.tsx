'use client';

import { useActionState } from 'react';
import { deleteAccount } from '@/app/profil/donnees/actions';

type DeleteState = { error: string | null };
const initial: DeleteState = { error: null };

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState(deleteAccount, initial);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm('Supprimer définitivement votre compte et toutes vos données ?')) event.preventDefault();
      }}
      className="space-y-3"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-300">Pour confirmer, saisissez votre pseudo : <strong>{username}</strong></span>
        <input name="confirmation" autoComplete="off" className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:border-red-400" />
      </label>
      <button type="submit" disabled={pending} className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60">
        {pending ? 'Suppression…' : 'Supprimer mon compte'}
      </button>
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
    </form>
  );
}
