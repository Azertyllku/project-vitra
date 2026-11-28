'use client';

/** Bouton d'action destructive avec confirmation (l'action serveur est liée côté page). */
export function AdminDeleteButton({ action, label, buttonLabel = 'Supprimer', message }: { action: () => Promise<void>; label: string; buttonLabel?: string; message?: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message ?? `Supprimer ${label} ? Cette action est définitive.`)) event.preventDefault();
      }}
    >
      <button type="submit" className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10">
        {buttonLabel}
      </button>
    </form>
  );
}
