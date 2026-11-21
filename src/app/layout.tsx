import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'ESPORT HUB',
  description: 'Suivez l\'esport, regardez les compétitions et analysez vos performances.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="fr">
      <body className="min-h-screen">
        <header className="border-b border-[var(--border)]">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-bold tracking-wide">
              ESPORT <span className="text-[var(--accent)]">HUB</span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              {user ? (
                <Link href="/profil" className="hover:text-[var(--accent-blue)]">Mon profil</Link>
              ) : (
                <>
                  <Link href="/connexion" className="hover:text-[var(--accent-blue)]">Connexion</Link>
                  <Link href="/inscription" className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium">S'inscrire</Link>
                </>
              )}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
