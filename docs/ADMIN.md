# Administration

Page : `/admin` (lien « Admin » dans l'en-tête pour le staff). Accès : rôles `editor`, `admin`, `super_admin`.

## Gestion du contenu (phase 8, première partie)

Jeux, équipes, joueurs, tournois et matchs : liste avec recherche et pagination, création, modification, suppression.

- Les formulaires sont décrits dans `src/lib/admin/entities.ts` (une configuration par type de contenu) : ajouter un champ ou
  un type de contenu revient à modifier cette configuration.
- Les écritures passent par des Server Actions (`src/app/admin/actions.ts`) qui valident chaque champ, puis écrivent avec la session du
  membre : la **RLS** reste la vraie barrière (écriture : staff ; suppression : admin et super admin).
- Les dates sont saisies et affichées à l'heure de Paris.
- Un match enregistre ses deux équipes et scores (`match_teams`) ; pour un match « terminé », le vainqueur est déduit des scores.
  Passer un match « en direct » déclenche la notification existante.
- La provenance des données (saisie manuelle, officielle, import, démonstration) est choisie à chaque saisie ; « saisie manuelle » par défaut.
- Après chaque écriture, le site public est rafraîchi (cache du catalogue des jeux compris).

## Pas encore fait (suite de la phase 8)

Effectifs et transferts, participants de tournoi, phases et groupes, gestion des diffusions et des droits, utilisateurs et sanctions,
réglages de la plateforme, sources de données et journal des actions d'administration.
