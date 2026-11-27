'use client';

import { useState } from 'react';

export interface ConnectProvider {
  id: string;
  label: string;
  configured: boolean;
  games: { slug: string; name: string }[];
}

const button = 'rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:brightness-110';

/** Un bloc par fournisseur : choix du jeu puis connexion (redirection vers le fournisseur, jamais de mot de passe saisi ici). */
export function ConnectPanel({ providers }: { providers: ConnectProvider[] }) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {providers.map((provider) => {
        const slug = selected[provider.id] ?? provider.games[0]?.slug ?? '';
        return (
          <li key={provider.id} className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-medium">{provider.label}</p>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-400">Jeu</span>
              <select
                value={slug}
                onChange={(event) => setSelected({ ...selected, [provider.id]: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:border-[var(--accent)]"
              >
                {provider.games.map((game) => (
                  <option key={game.slug} value={game.slug}>{game.name}</option>
                ))}
              </select>
            </label>
            {provider.configured ? (
              <a href={`/api/connect/${provider.id}/start?game=${encodeURIComponent(slug)}`} className={`${button} inline-block`}>
                Connecter {provider.label}
              </a>
            ) : (
              <p className="text-xs text-zinc-500">Pas encore activé : les clés d’application de ce fournisseur doivent être renseignées côté serveur.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
