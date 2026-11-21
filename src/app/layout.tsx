import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ESPORT HUB', template: '%s — ESPORT HUB' },
  description: 'Suivez l’esport, regardez les compétitions et analysez vos performances.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
