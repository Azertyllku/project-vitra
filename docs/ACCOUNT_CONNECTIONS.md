# Connexion des comptes de jeu

Page : `/profil/comptes`. Le membre est redirigé vers le fournisseur, prouve qu'il possède le compte, puis ESPORT HUB
enregistre le compte comme **vérifié** (`verification_status = 'verified'`, `data_source = 'official'`). Aucun mot de passe
n'est jamais saisi sur ESPORT HUB.

## Fonctionnement

1. `GET /api/connect/<fournisseur>/start?game=<slug>` : contrôle le membre connecté, génère un jeton `state` aléatoire
   (cookie `connect_state`, HttpOnly, 10 min) et redirige vers le fournisseur.
2. `GET /api/connect/<fournisseur>/callback` : compare le `state`, vérifie l'identité auprès du fournisseur, puis appelle
   `linkVerifiedAccount` (client service, `SUPABASE_SERVICE_ROLE_KEY`). La RLS empêche un membre de se déclarer lui-même
   « vérifié » ; un index unique garantit qu'un compte de jeu n'est vérifié que pour un seul membre.

## Fournisseurs

| Fournisseur | Jeux | Clés nécessaires | Méthode |
|---|---|---|---|
| Steam | Counter-Strike 2, Dota 2, PUBG, Apex Legends | aucune (`STEAM_API_KEY` facultative : pseudo) | OpenID 2.0 |
| Riot Games | League of Legends, Valorant, TFT | `RIOT_CLIENT_ID`, `RIOT_CLIENT_SECRET` | OAuth 2.0 (Riot Sign On) |
| Battle.net | Overwatch 2, StarCraft II, Call of Duty | `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET` | OAuth 2.0 |
| Epic Games | Fortnite, Rocket League | `EPIC_CLIENT_ID`, `EPIC_CLIENT_SECRET` | OAuth 2.0 |

- Dota 2 via Steam crée un compte `opendota` (ID 32 bits) : le bouton de synchronisation devient disponible.
- Les URL de retour à déclarer chez chaque fournisseur : `<NEXT_PUBLIC_SITE_URL>/api/connect/<riot|blizzard|epic>/callback`.
- Riot, Blizzard et Epic exigent d'enregistrer une application (Riot : approbation de la clé de production) et un site en HTTPS.
  Tant que les clés manquent, le bouton est remplacé par un message « pas encore activé ».
- Les points d'accès OAuth (autorisation, jeton, profil) sont ceux publiés par chaque fournisseur : à vérifier avec vos clés
  lors du premier test, ils n'ont pas pu être essayés sans identifiants.
- Statistiques officielles : la vérification prouve la propriété du compte ; l'import des parties nécessite en plus les
  connecteurs de `docs/CONNECTORS.md`.
