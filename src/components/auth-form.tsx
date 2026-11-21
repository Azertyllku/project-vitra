import type { ReactNode } from 'react';

export function AuthCard({ title, error, message, children }: { title: string; error?: string; message?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {message}
          </p>
        )}
        {children}
      </div>
    </main>
  );
}

export function Field({ label, name, type = 'text', autoComplete, minLength }: { label: string; name: string; type?: string; autoComplete?: string; minLength?: number }) {
  return (
    <label className="mb-4 block text-sm">
      <span className="mb-1 block text-zinc-300">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        minLength={minLength}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-medium transition hover:brightness-110">
      {children}
    </button>
  );
}
