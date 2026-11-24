# Premium, paiements Stripe et rapports IA

## État à la livraison

Tout est **construit et déployé, mais désactivé** tant que vous n'avez pas fourni vos clés :

| Élément | État |
|---|---|
| Paiement | `billing_enabled = false` (réglage public) ; offres `premium_monthly` / `premium_yearly` inactives, **sans prix** |
| Rapports IA | fonctionnent dès maintenant en mode **règles** (provider `rules`) ; modèle de langage actif seulement avec `ANTHROPIC_API_KEY` |
| Alertes de série, tableau de bord personnalisable, statistiques avancées | actifs pour tout membre ayant le rôle `premium` (ou admin / super_admin) |

Le site reste entièrement utilisable sans paiement.

## Ce qu'il faut obtenir et configurer

### Stripe

1. Un compte Stripe (mode test d'abord).
2. Dans Stripe : créer un produit « Premium » avec deux prix récurrents (mensuel, annuel) — **vous décidez des tarifs**.
3. Dans Supabase (Edge Functions > Secrets) : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` (ex. `https://votre-domaine.fr`).
4. Dans Stripe > Webhooks : ajouter l'endpoint `https://<projet>.supabase.co/functions/v1/stripe-webhook` pour les événements
   `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.
5. Activer le portail de facturation Stripe (Paramètres > Facturation > Portail client).
6. En SQL (ou depuis l'administration, phase 8) : renseigner `subscription_plans.stripe_price_id`, `price_cents`, passer `is_active = true`,
   puis `update platform_settings set value = 'true' where key = 'billing_enabled'`.

### IA (facultatif)

`ANTHROPIC_API_KEY` (secret Edge Functions) ; `AI_MODEL` pour changer de modèle (défaut `claude-sonnet-5-5`).
Sans clé, les rapports restent disponibles en mode règles, clairement étiquetés « Rapport automatique ».

## Sécurité

- `stripe-webhook` est déployée sans JWT (Stripe n'en envoie pas) : l'authenticité repose sur la **signature HMAC** (tolérance anti-rejeu 5 min,
  comparaison à temps constant), l'idempotence sur `stripe_events`.
- Le rôle `premium` n'est attribué que par ce webhook (ou par un super_admin) : un membre ne peut pas se l'attribuer (RLS testée).
- Les clés Stripe et IA ne sont jamais côté navigateur.
- Les rapports IA lisent les données avec les droits du membre ; seules des données agrégées et nettoyées sont transmises au modèle,
  qui a pour consigne de ne rien inventer. Les données envoyées sont conservées dans `ai_reports.input_summary`.
- Limite : 10 rapports / 24 h / membre.

## Accès Premium

`active` et `trialing` donnent le rôle ; `past_due` conserve l'accès pendant les relances de paiement ; `canceled`, `unpaid`,
`incomplete_expired` le retirent.
