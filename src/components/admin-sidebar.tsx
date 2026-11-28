'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface AdminNavGroup {
  title: string;
  items: { label: string; href: string }[];
}

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation de l'administration : barre latérale fixe sur grand écran, menu déroulant sur mobile. */
export function AdminSidebar({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const item = (href: string, label: string, onNavigate?: () => void) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? 'bg-[var(--accent)]/20 font-medium text-white' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}
      >
        {label}
      </Link>
    );
  };

  const list = (onNavigate?: () => void) => (
    <nav aria-label="Administration" className="space-y-5">
      {item('/admin', 'Tableau de bord', onNavigate)}
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{group.title}</p>
          <ul className="space-y-0.5">
            {group.items.map((entry) => (
              <li key={entry.href}>{item(entry.href, entry.label, onNavigate)}</li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-menu-mobile"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm"
        >
          Menu d’administration
          <span aria-hidden="true" className="text-zinc-400">{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div id="admin-menu-mobile" className="mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            {list(() => setOpen(false))}
          </div>
        )}
      </div>
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">{list()}</div>
      </aside>
    </>
  );
}
