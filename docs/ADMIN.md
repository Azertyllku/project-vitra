# Administration

Page : `/admin` (lien « Admin » dans l'en-tête pour le staff). Accès : rôles `editor`, `admin`, `super_admin`.

## Contenu (liste, recherche, création, modification, suppression)

| Groupe | Sections |
|---|---|
| Contenu | Jeux, Équipes, Joueurs, Effectifs (arrivées et départs), Tournois, Phases, Groupes, Participants, Matchs |
| Diffusion | Diffusions, Sources de diffusion (droits), Rediffusions (droits) |
| Plateforme | Sources de données (admin), Journal des synchronisations, Journal d'administration (admin), Utilisateurs, Réglages |

- Les formulaires sont décrits dans `src/lib/admin/entities.ts` (une configuration par type de contenu) : ajouter un champ ou
  un type de contenu revient à modifier ce fichier.
- Les écritures passent par des Server Actions (`src/app/admin/actions.ts`, `user-actions.ts`) qui valident chaque champ, puis écrivent avec la session du
  membre : la **RLS** reste la vraie barrière (écriture : staff ; suppression : admin et super admin).
- Dates saisies et affichées à l'heure de Paris. La provenance des données est choisie à chaque saisie (« saisie manuelle » par défaut).
- Un match enregistre ses deux équipes et scores ; le vainqueur est déduit des scores d'un match terminé. Passer un match « en direct »
  déclenche la notification existante.
- **Droits de diffusion** : une source ou une rediffusion n'est visible du public que si son statut est « autorisé » **et** que le titulaire des droits est renseigné (règle de la base, vérifiée aussi dans le formulaire). Les formats de référence (chaîne Twitch, identifiant YouTube, URL HLS https) sont contrôlés.
- **Transfert** : renseigner la date de départ dans l'ancien effectif, puis ajouter le joueur dans la nouvelle équipe.
- **Utilisateurs** : recherche par pseudo ou ESPORT ID ; attribution et retrait de rôles (super administrateurs uniquement, on ne peut pas retirer son propre rôle de super administrateur) ; sourdine ou bannissement avec motif et date de fin facultative.
- **Réglages** : valeurs JSON de `platform_settings` (administrateurs).
- **Journal d'administration** : chaque création, modification, suppression, rôle, sanction et réglage est inscrit dans `admin_logs` (migration 019), lisible par les administrateurs, jamais modifiable.
- Après chaque écriture, le site public est rafraîchi (cache du catalogue des jeux compris).

## Limites connues

- Une diffusion ne peut pas encore être rattachée à un match précis depuis l'administration (jeu et tournoi seulement).
- Les listes déroulantes de relation affichent au plus 500 éléments (joueurs, équipes) : une recherche sera nécessaire au-delà.
- Les clés d'API ne se saisissent jamais ici : seul le nom du secret Supabase est noté dans « Sources de données ».
