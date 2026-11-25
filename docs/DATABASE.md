# Base de données ESPORT HUB

Projet Supabase : `ESPORT-HUB` (région `eu-west-1`, Postgres 17).

## Migrations (supabase/migrations/)

Toutes additives, appliquées dans l'ordre. Aucune ne supprime de table ni de donnée.
Les fichiers du dépôt reprennent le SQL appliqué ; les horodatages de la table `supabase_migrations` côté Supabase diffèrent (`list_migrations` fait foi pour l'état réel).

| N° | Fichier | Contenu |
|---|---|---|
| 001 | extensions_and_helpers | extensions, schéma `private`, types énumérés |
| 002 | identity_esport_id_roles | profils, ESPORT ID, rôles, préférences, favoris, RLS |
| 003 | games_catalog | jeux, modes, définitions de stats, intégrations API, références externes |
| 004 | players_and_teams | joueurs, équipes, effectifs, historique, stats d'équipe |
| 005 | tournaments_and_matches | tournois, phases, groupes, matchs, résultats, événements |
| 006 | accounts_and_statistics | comptes de jeux, historique de parties (partitionné par année), stats, rangs, succès |
| 007 | storage_buckets | buckets `avatars`, `banners`, `logos` + politiques |
| 008 | realtime | publication Realtime des tables de matchs |
| 009 | security_hardening | révocation d'EXECUTE sur `rls_auto_enable()`, accès direct aux partitions retiré |
| 010 | seed_games_catalog | catalogue initial des 15 jeux |
| 011 | team_standings_view | classement des équipes par jeu (vue `security_invoker`) |
| 012 | streaming_and_vods | diffusions, sources autorisées, rediffusions, chapitres, historique, favoris, playlists |
| 013 | performance_tracker | définitions de stats par jeu, journal de synchronisation, fonction `account_performance` |
| 014 | community | publications, commentaires, réactions, abonnements, messagerie, notifications, chat, signalements, anti-spam, sanctions |
| 015 | community_moderation_access | le staff ne lit un message privé que s'il est signalé |
| 016 | premium_billing_ai | réglages de plateforme, offres et abonnements Stripe, paiements, rapports IA, tableau de bord personnalisable, alertes de série |

## ESPORT ID

Format `EH-XXXXXXXX` (alphabet sans `0`, `O`, `1`, `I`). Généré par `private.generate_esport_id()` à l'inscription (trigger `on_auth_user_created`), unique, immuable (trigger `profiles_protect_identity`).

## Principes RLS

- Catalogue public : lecture pour tous, écriture `editor`/`admin`/`super_admin`, suppression `admin`.
- Données privées (préférences, favoris, comptes de jeux non publics, historique, messages, notifications, rapports IA) : propriétaire uniquement.
- Les rôles sont dans `user_roles` ; seul un `super_admin` les modifie, et le webhook Stripe (service_role) pour `premium`. Premier `super_admin` : à créer manuellement en SQL.
- Les données `official` / `imported` ne s'écrivent que via `service_role` (Edge Functions). Un utilisateur ne peut saisir que des données `manual`.
- `data_source = 'demo'` identifie toute donnée de test.
- Sources vidéo et rediffusions : visibles publiquement seulement si `rights_status = 'authorized'` et titulaire des droits renseigné.
- Communauté : un membre en sourdine (`user_sanctions`) ne peut plus publier, commenter, écrire, réagir ni chatter ; seul le staff masque un contenu.
- Facturation : abonnements, paiements et rapports IA ne sont écrits que par les Edge Functions ; `stripe_events` est inaccessible hors service_role.

## Edge Functions

`sync-account` (import de parties), `ai-report` (rapports IA), `create-checkout-session`, `create-portal-session`, `stripe-webhook` (sans JWT, signature HMAC vérifiée), `health`, `sync-game-data`. Voir `docs/CONNECTORS.md` et `docs/BILLING_AND_AI.md`.

## Tests exécutés sur la base (rollback systématique, aucune donnée conservée)

- Phase 1-2 : 24 scénarios (profil auto, ESPORT ID immuable, auto-promotion bloquée, isolation, visiteur, staff).
- Phase 4 : 16 scénarios (droits de diffusion, références invalides, isolation de l'historique et des playlists).
- Phase 5 : 13 scénarios (agrégats, séries, moyennes, filtre de période, isolation).
- Phase 6 : 42 scénarios (adhésion, anti-spam, limites de fréquence, modération, notifications et préférences, messagerie et blocage, chat, signalements, visiteur).
- Phase 7 : 19 scénarios (aucun prix inventé, Premium non auto-attribuable, abonnements/paiements/rapports non fabricables, personnalisation réservée, alertes de série et préférences, réglages).
- Hors base (Node) : vérification de la signature Stripe (8 cas : valide, corps modifié, mauvais secret, rejeu, en-tête absent ou mal formé, plusieurs v1, longueur différente) et générateur de rapports par règles (12 cas).

## Types TypeScript

`npm run db:types` génère `src/types/database.ts` (Supabase CLI). Pas encore généré : le code actuel utilise des interfaces locales minimales.
