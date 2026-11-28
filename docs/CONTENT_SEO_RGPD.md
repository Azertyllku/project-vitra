# Actualités, recherche, SEO et RGPD

## Actualités

- Table `articles` (migration 020) : titre, chapô, texte brut, couverture, catégorie, jeu, statut (brouillon / publié), date de publication, source.
- Public : `/actualites` (filtre par catégorie, pagination) et `/actualites/<slug>`. Un article n'est visible que s'il est publié et que sa date est passée (publication programmée possible). Les sources tierces sont citées avec un lien `nofollow`.
- Administration : section « Actualités » du groupe Contenu. Date de publication vide = publication immédiate ; l'auteur est le membre connecté.
- Pas encore fait : commentaires d'articles, tags, partage, agrégation de flux externes.

## Recherche globale

`/recherche` et suggestions (`/api/search`) sur joueurs, équipes, jeux, tournois, articles publiés, rediffusions autorisées et communautés. La recherche s'exécute avec les droits du visiteur (RLS). Icône de recherche dans l'en-tête. La recherche porte sur le texte contenu dans le nom ou le titre (pas de tolérance aux fautes de frappe).

## SEO

`sitemap.xml` (pages publiques + fiches, 1 000 entrées par type), `robots.txt` (zones privées exclues), métadonnées et Open Graph par défaut, données structurées `WebSite` (avec recherche) et `NewsArticle`. Définir `NEXT_PUBLIC_SITE_URL` sur l'adresse de production avant la mise en ligne. Pas encore fait : image de partage par défaut, métadonnées dédiées sur toutes les fiches équipe, joueur et jeu, données structurées des tournois et matchs.

## RGPD

- `/confidentialite` : données traitées, finalités, destinataires, durées, droits, cookies. Contact : `NEXT_PUBLIC_CONTACT_EMAIL`.
- Bandeau d'information sur les cookies : le site n'utilise que des cookies strictement nécessaires, donc pas de recueil de consentement. **Si un outil de mesure d'audience ou de publicité est ajouté, il faudra un vrai consentement (accepter / refuser) avant tout dépôt.**
- `/profil/donnees` : export JSON des données du membre (`/api/account/export`) et suppression du compte (confirmation par saisie du pseudo, suppression en cascade, nécessite `SUPABASE_SERVICE_ROLE_KEY`). Le dernier super administrateur ne peut pas se supprimer.

### À compléter par l'éditeur avant l'ouverture publique

Ces textes décrivent le fonctionnement réel du site mais ne remplacent pas un avis juridique. Il reste à fournir :

- les **mentions légales** (identité de l'éditeur, directeur de publication, hébergeur) : page non créée, ces informations ne peuvent venir que de vous ;
- l'adresse de contact (`NEXT_PUBLIC_CONTACT_EMAIL`) et, si une société exploite le site, son identité dans la politique de confidentialité ;
- les conditions générales d'utilisation et les règles de la communauté si vous le souhaitez ;
- la vérification des cookies réellement déposés par les lecteurs Twitch et YouTube (idealement, ne les charger qu'au clic).
