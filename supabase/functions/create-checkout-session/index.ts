import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient, userClient } from '../_shared/clients.ts';
import { stripeKey, stripeRequest } from '../_shared/stripe.ts';

/**
 * Crée une session Stripe Checkout pour un abonnement Premium.
 * Refuse tant que le paiement n'est pas activé (réglage billing_enabled), que Stripe n'est pas configuré
 * ou que l'offre n'a pas de prix Stripe : jamais de paiement « simulé ».
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed', message: 'Méthode non autorisée.' }, 405);

  const { data: auth, error: authError } = await userClient(req).auth.getUser();
  if (authError || !auth.user) return json({ error: 'unauthorized', message: 'Connexion requise.' }, 401);
  const user = auth.user;

  const admin = adminClient();
  const key = stripeKey();
  const site = Deno.env.get('SITE_URL') ?? '';
  const { data: setting } = await admin.from('platform_settings').select('value').eq('key', 'billing_enabled').maybeSingle();
  if (!key || setting?.value !== true || !/^https?:\/\/[^\s]+$/.test(site)) {
    return json({ error: 'billing_disabled', message: 'Le paiement n\u2019est pas encore disponible.' }, 503);
  }

  const body = await req.json().catch(() => ({}));
  const code = typeof body.plan_code === 'string' && /^[a-z0-9_]+$/.test(body.plan_code) ? body.plan_code : null;
  if (!code) return json({ error: 'bad_request', message: 'Offre invalide.' }, 400);

  const { data: plan } = await admin.from('subscription_plans').select('id, stripe_price_id, is_active').eq('code', code).maybeSingle();
  if (!plan || !plan.is_active || !plan.stripe_price_id) return json({ error: 'plan_unavailable', message: 'Cette offre n\u2019est pas disponible.' }, 404);

  const { data: existing } = await admin.from('subscriptions').select('id').eq('user_id', user.id).in('status', ['active', 'trialing', 'past_due']).limit(1);
  if (existing && existing.length > 0) return json({ error: 'already_subscribed', message: 'Vous avez déjà un abonnement actif : gérez-le depuis le portail de facturation.' }, 409);

  try {
    let { data: customer } = await admin.from('stripe_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (!customer) {
      const created = await stripeRequest('/customers', { 'metadata[user_id]': user.id, ...(user.email ? { email: user.email } : {}) }, key);
      const { error } = await admin.from('stripe_customers').insert({ user_id: user.id, stripe_customer_id: created.id });
      if (error) throw new Error('Enregistrement du client impossible.');
      customer = { stripe_customer_id: created.id };
    }
    const session = await stripeRequest('/checkout/sessions', {
      mode: 'subscription',
      customer: customer.stripe_customer_id,
      'line_items[0][price]': plan.stripe_price_id,
      'line_items[0][quantity]': '1',
      success_url: `${site}/premium?statut=succes`,
      cancel_url: `${site}/premium?statut=annule`,
      client_reference_id: user.id,
      'metadata[user_id]': user.id,
      'subscription_data[metadata][user_id]': user.id,
    }, key);
    return json({ url: session.url });
  } catch (error) {
    return json({ error: 'stripe_error', message: error instanceof Error ? error.message : 'Erreur de paiement.' }, 502);
  }
});
