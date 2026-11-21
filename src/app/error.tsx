'use client';

export default function GlobalRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold">Une erreur est survenue</h1>
      <p className="mt-3 text-zinc-400">Le chargement de cette page a échoué. Réessayez dans un instant.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium hover:brightness-110">
        Réessayer
      </button>
    </main>
  );
}
