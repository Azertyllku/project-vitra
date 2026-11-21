import Link from 'next/link';
import type { ReactNode } from 'react';
import { MATCH_STATUS_LABEL } from '@/lib/format';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function SectionTitle({ children, href, hrefLabel }: { children: ReactNode; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-4 mt-10 flex items-baseline justify-between">
      <h2 className="text-xl font-semibold">{children}</h2>
      {href && (
        <Link href={href} className="text-sm text-[var(--accent-blue)] hover:underline">
          {hrefLabel ?? 'Tout voir'}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-zinc-400">{children}</p>;
}

export function ErrorState({ children }: { children?: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
      {children ?? 'Impossible de charger ces données pour le moment. Réessayez dans un instant.'}
    </p>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'violet' | 'amber' }) {
  const tones = {
    neutral: 'border-[var(--border)] text-zinc-300',
    violet: 'border-violet-500/50 bg-violet-500/10 text-violet-200',
    amber: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  };
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    live: 'border-red-500/60 bg-red-500/15 text-red-200',
    scheduled: 'border-blue-500/50 bg-blue-500/10 text-blue-200',
    finished: 'border-[var(--border)] text-zinc-300',
    postponed: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
    cancelled: 'border-[var(--border)] text-zinc-500',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.finished}`}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
      {MATCH_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Logo({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`Logo ${name}`} width={size} height={size} className="shrink-0 rounded-lg object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-semibold text-zinc-300"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function FilterTabs({ items }: { items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label="Filtres" className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
            item.active ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white' : 'border-[var(--border)] text-zinc-400 hover:text-white'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Pager({ basePath, params, page, hasNext }: { basePath: string; params: Record<string, string>; page: number; hasNext: boolean }) {
  if (page <= 1 && !hasNext) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams(params);
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const cls = 'rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-white/5';
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
      {page > 1 ? <Link href={href(page - 1)} className={cls}>← Précédent</Link> : <span />}
      <span className="text-sm text-zinc-500">Page {page}</span>
      {hasNext ? <Link href={href(page + 1)} className={cls}>Suivant →</Link> : <span />}
    </nav>
  );
}
