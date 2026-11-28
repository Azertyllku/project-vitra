import type { Metadata } from 'next';
import { CookieNotice } from '@/components/cookie-notice';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { siteUrl } from '@/lib/env';
import './globals.css';

const DESCRIPTION = 'Suivez l’esport, regardez les compétitions et analysez vos performances.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'ESPORT HUB — Tout l’esport, au même endroit', template: '%s — ESPORT HUB' },
  description: DESCRIPTION,
  applicationName: 'ESPORT HUB',
  openGraph: { type: 'website', siteName: 'ESPORT HUB', locale: 'fr_FR', title: 'ESPORT HUB', description: DESCRIPTION },
  twitter: { card: 'summary', title: 'ESPORT HUB', description: DESCRIPTION },
};

const webSite = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ESPORT HUB',
  url: siteUrl(),
  potentialAction: { '@type': 'SearchAction', target: `${siteUrl().replace(/\/$/, '')}/recherche?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSite).replace(/</g, '\\u003c') }} />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <CookieNotice />
      </body>
    </html>
  );
}
