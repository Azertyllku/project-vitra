'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

interface Hit {
  type: string;
  label: string;
  sub: string | null;
  href: string;
}

/** Champ de recherche avec suggestions (appel à /api/search après 250 ms sans frappe). Entrée : page de résultats complète. */
export function SearchBox({ defaultValue = '' }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef(0);

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    const query = next.trim();
    if (query.length < 2) {
      request.current += 1;
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const id = ++request.current;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok || id !== request.current) return;
        const data = (await response.json()) as { hits?: Hit[] };
        setHits(data.hits ?? []);
        setOpen(true);
      } catch {
        // les suggestions sont facultatives : la recherche complète reste disponible
      }
    }, 250);
  }

  return (
    <div
      className="relative max-w-xl"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form action="/recherche" role="search" className="flex gap-2">
        <input
          name="q"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Joueur, équipe, jeu, tournoi, article…"
          autoComplete="off"
          maxLength={60}
          aria-label="Rechercher"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:brightness-110">Rechercher</button>
      </form>
      {open && hits.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          {hits.map((hit) => (
            <li key={`${hit.type}-${hit.href}`}>
              <Link href={hit.href} className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-white/5">
                <span className="truncate">{hit.label}{hit.sub && <span className="ml-2 text-xs text-zinc-500">{hit.sub}</span>}</span>
                <span className="shrink-0 text-xs text-zinc-500">{hit.type}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
