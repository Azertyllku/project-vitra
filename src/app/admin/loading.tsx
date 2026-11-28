export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-white/5" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-white/5" />
      <div className="mt-8 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
        ))}
      </div>
    </div>
  );
}
