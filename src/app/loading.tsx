export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10" aria-busy="true" aria-label="Chargement">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white/5" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-white/5" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        ))}
      </div>
    </main>
  );
}
