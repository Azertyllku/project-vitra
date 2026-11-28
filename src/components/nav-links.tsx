'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  label: string;
  href: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

function isActive(pathname: string, href: string, exact = false) {
  if (href === '/' || exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const base = 'whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors';
const on = 'bg-white/10 text-white';
const off = 'text-zinc-300 hover:bg-white/5 hover:text-white';

/** Lien de navigation avec état actif (`exact` : actif uniquement sur l'adresse exacte). */
export function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const active = isActive(usePathname(), href, exact);
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={`${base} ${active ? on : off}`}>
      {children}
    </Link>
  );
}

/** Menu déroulant (survol ou focus clavier), sans JavaScript d'ouverture. */
export function NavDropdown({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const active = group.items.some((item) => isActive(pathname, item.href));
  return (
    <div className="group relative">
      <button type="button" aria-haspopup="true" className={`${base} flex items-center gap-1 ${active ? on : off}`}>
        {group.label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="opacity-60 transition-transform group-hover:rotate-180 group-focus-within:rotate-180">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <ul className="min-w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
          {group.items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm ${isActive(pathname, item.href) ? on : off}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Menu mobile (jusqu'à 1280 px) : se referme à chaque navigation. */
export function MobileMenu({ sections, accountItems }: { sections: { title?: string; items: NavItem[] }[]; accountItems: (NavItem & { primary?: boolean })[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const row = (active: boolean) => `block rounded-lg px-3 py-2 text-sm ${active ? on : off}`;
  return (
    <div className="relative xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="menu-mobile"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
      >
        {open ? 'Fermer' : 'Menu'}
      </button>
      {open && (
        <div id="menu-mobile" className="absolute right-0 top-full mt-3 max-h-[calc(100vh-5rem)] w-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
          {sections.map((section, index) => (
            <div key={section.title ?? index} className={index > 0 ? 'mt-3 border-t border-[var(--border)] pt-3' : ''}>
              {section.title && <p className="px-3 pb-1 text-xs uppercase tracking-wider text-zinc-500">{section.title}</p>}
              <ul>
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} onClick={close} aria-current={isActive(pathname, item.href) ? 'page' : undefined} className={row(isActive(pathname, item.href))}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <ul className="mt-3 border-t border-[var(--border)] pt-3">
            {accountItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  className={item.primary ? 'block rounded-lg bg-[var(--accent)] px-3 py-2 text-center text-sm font-medium' : row(isActive(pathname, item.href))}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
