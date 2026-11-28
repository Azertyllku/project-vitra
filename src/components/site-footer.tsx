import Link from 'next/link';

const LINKS = [
  { href: '/actualites', label: 'Actualités' },
  { href: '/recherche', label: 'Recherche' },
  { href: '/confidentialite', label: 'Confidentialité et cookies' },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] px-6 py-8 text-sm text-zinc-500">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} ESPORT HUB</p>
        <ul className="flex flex-wrap gap-5">
          {LINKS.map((link) => (
            <li key={link.href}><Link href={link.href} className="hover:text-white">{link.label}</Link></li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
