# Vitra

Plateforme esport multi-jeux : Next.js 15 (App Router) + TypeScript + Tailwind 4 + Supabase.

## Démarrage

```bash
cp .env.example .env.local   # puis renseigner SUPABASE_SERVICE_ROLE_KEY si besoin (serveur uniquement)
npm install
npm run dev
```

## Sécurité des clés

- Le navigateur n'utilise que `NEXT_PUBLIC_SUPABASE_URL` et la clé *publishable* ; la RLS protège les données.
- `SUPABASE_SERVICE_ROLE_KEY` n'est jamais préfixée `NEXT_PUBLIC_` et n'est lue que par `src/lib/supabase/admin.ts` (`server-only`) et les Edge Functions.

## Base de données

Voir [docs/DATABASE.md](docs/DATABASE.md). Migrations versionnées dans `supabase/migrations/`.

## Edge Functions

`supabase/functions/` : `health`, `sync-game-data` (dispatcher des connecteurs, réservé au staff) et `_shared/`.
