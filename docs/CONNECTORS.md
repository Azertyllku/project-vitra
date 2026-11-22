# Connecteurs de données de jeux

Chaque jeu a son propre connecteur (`supabase/functions/_shared/`). Un connecteur déclare ce qu'il sait réellement
fournir ; tout le reste s'affiche « indisponible » ou se saisit manuellement. Jamais de statistique inventée.

## Fonctionnement

1. Le membre ajoute un compte de jeu (`/profil/performances`). Un compte « déclaré » est purement manuel.
2. Pour un compte doté d'un connecteur, « Synchroniser maintenant » appelle l'Edge Function `sync-account`.
3. La fonction vérifie la connexion et la propriété du compte, applique une limite de **15 minutes** par compte,
   récupère les parties, **valide** chaque ligne, **déduplique** (`account_id + external_match_id + played_at`),
   écrit avec la clé `service_role` (jamais exposée au navigateur) et journalise dans `data_sync_logs`.
4. Chaque partie porte sa provenance : `official`, `imported` ou `manual` (badge affiché à l'écran).

## État des connecteurs

| Jeu | Fournisseur | État | Provenance | Ce qu'il faut obtenir |
|---|---|---|---|---|
| Dota 2 | OpenDota (API publique tierce) | **Implémenté** (20 dernières parties) | `imported` | Rien (quota gratuit). Le joueur doit activer « Exposer les données publiques des matchs ». |
| League of Legends, Valorant, TFT | Riot Games API | À faire | `official` | Clé développeur Riot (clé de production validée par Riot pour un usage public) + Riot Sign On pour prouver la propriété du compte. |
| Counter-Strike 2 | Pas d'API officielle de stats personnelles | À étudier | `imported` | Service tiers autorisé (ex. FACEIT Data API : clé FACEIT) ou import manuel. |
| PUBG | API officielle PUBG | À faire | `official` | Clé API sur le portail développeur PUBG. |
| StarCraft II | Blizzard API | À faire | `official` | Client OAuth Blizzard. |
| Rocket League, Fortnite, Apex, R6, Call of Duty, Overwatch 2, Street Fighter 6, EA Sports FC | Aucune API officielle publique fiable | Saisie manuelle | `manual` | Service tiers autorisé si un partenariat existe ; sinon import manuel. |

Les conditions d'accès des API changent : vérifier la documentation du fournisseur avant chaque intégration.

## Vérification de propriété

Un compte n'est visible publiquement que s'il est `verified` ET rendu public par son propriétaire. La vérification
nécessite une preuve de propriété (connexion OAuth/OpenID chez l'éditeur, p. ex. Steam OpenID ou Riot Sign On) ou une
validation par un administrateur (phase 8). Les comptes déclarés restent privés.

## Ajouter un connecteur

1. Créer `supabase/functions/_shared/<fournisseur>.ts` implémentant `GameConnector` (`provider`, `gameSlug`, `dataSource`,
   `capabilities`, `validateExternalId`, `fetchMatches`).
2. L'enregistrer dans `connectors` (`_shared/connectors.ts`).
3. Ajouter ses clés dans les secrets Supabase (`supabase secrets set ...`), jamais dans le code.
4. Ajouter les définitions de statistiques du jeu (`game_statistics_definitions`) si elles n'existent pas.
5. Exposer le type de compte dans `AddAccountForm` et `CONNECTOR_PROVIDERS` (`src/app/profil/performances/page.tsx`).
