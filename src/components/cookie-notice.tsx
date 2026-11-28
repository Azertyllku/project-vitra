'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';

const KEY = 'esport-hub-cookie-notice-v1';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}
function dismissedNow() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Information sur les cookies. ESPORT HUB n'utilise que des cookies strictement nécessaires (session, sécurité) : aucun
 * consentement n'est requis pour eux. Si un outil de mesure d'audience ou de publicité est ajouté un jour, ce bandeau devra
 * devenir un vrai recueil de consentement (accepter / refuser) avant tout dépôt.
 */
export function CookieNotice() {
  // Côté serveur, on considère l'information déjà lue : le bandeau n'apparaît qu'après hydratation, sans décalage.
  const dismissed = useSyncExternalStore(subscribe, dismissedNow, () => true);
  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      // stockage indisponible : le bandeau réapparaîtra, sans conséquence
    }
    window.dispatchEvent(new Event('storage'));
  }

  return (
    <div role="region" aria-label="Information sur les cookies" className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4 shadow-2xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <p className="max-w-3xl text-sm text-zinc-300">
          ESPORT HUB n’utilise que des cookies strictement nécessaires (connexion et sécurité) : ni publicité, ni mesure d’audience. Les lecteurs vidéo intégrés (Twitch, YouTube) sont des services tiers qui peuvent déposer leurs propres cookies lorsque vous lancez une vidéo.{' '}
          <Link href="/confidentialite" className="text-[var(--accent-blue)] underline">En savoir plus</Link>
        </p>
        <button type="button" onClick={dismiss} className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-medium hover:brightness-110">
          J’ai compris
        </button>
      </div>
    </div>
  );
}
