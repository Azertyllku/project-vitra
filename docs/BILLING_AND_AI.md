# Facturation (désactivée) et rapports IA

## État actuel : projet gratuit

Le projet reste **gratuit pour le moment**. L'offre Premium n'est plus proposée : plus de page `/premium`, plus de verrous.
Statistiques avancées, comparateur détaillé, rapports IA, tableau de bord personnalisable et alertes de série sont ouverts
à tout membre connecté (migration `018_free_for_all_members`).

Pour mémoire, l'infrastructure de paiement existe toujours mais est **inutilisée** : tables `subscription_plans`, `subscriptions`,
`payments`, `stripe_*`, fonctions Edge `create-checkout-session`, `create-portal-session`, `stripe-webhook`, réglage
`billing_enabled = false` et offres inactives. Rien n'a été supprimé en base. Une future offre payante demandera de recréer
l'interface d'abonnement (la page et les boutons ont été retirés du site) et de redécider quelles fonctionnalités restent gratuites.

## Rapports IA

| Élément | État |
|---|---|
| Rapports IA | fonctionnent en mode **règles** (`provider = 'rules'`) ; modèle de langage actif seulement avec `ANTHROPIC_API_KEY` |

Configuration (facultative) : secret Edge Functions `ANTHROPIC_API_KEY` ; `AI_MODEL` pour changer de modèle (défaut `claude-sonnet-5-5`).
Sans clé, les rapports restent disponibles, clairement étiquetés « Rapport automatique ».

## Sécurité

- Les rapports IA lisent les données avec les droits du membre ; seules des données agrégées et nettoyées sont transmises au modèle,
  qui a pour consigne de ne rien inventer. Les données envoyées sont conservées dans `ai_reports.input_summary`.
- Limite : 10 rapports / 24 h / membre. Les clés IA ne sont jamais côté navigateur.
- Les Edge Functions Stripe restent déployées mais refusent toute requête tant que `billing_enabled` est à `false`.
