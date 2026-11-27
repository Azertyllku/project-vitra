'use client';

/** Bouton de suppression avec confirmation (l'action serveur est liée côté page). */
export function AdminDeleteButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Supprimer ${label} ? Cette action est définitive.`)) event.preventDefault();
      }}
    >
      <button type="submit" className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10">
        Supprimer
      </button>
    </form>
  );
}
