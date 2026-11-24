import Link from 'next/link';
import type { ReactNode } from 'react';

/** Encart affiché à la place d'une fonctionnalité réservée aux membres Premium. */
export function PremiumLock({ title = 'Fonctionnalité Premium', children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-violet-500/40 bg-violet-500/5 p-6">
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-sm text-zinc-400">{children}</p>}
      <Link href="/premium" className="mt-3 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:brightness-110">
        Découvrir Premium
      </Link>
    </div>
  );
}
