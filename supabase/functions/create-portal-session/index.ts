import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient, userClient } from '../_shared/clients.ts';
import { stripeKey, stripeRequest } from '../_shared/stripe.ts';

/** Ouvre le portail de facturation Stripe (changer de moyen de paiement, annuler, factures) pour un abonné. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed', message: 'Méthode non autorisée.' }, 405);

  const { data: auth, error: authError } = await userClient(req).auth.getUser();
  if (authError || !auth.user) return json({ error: 'unauthorized', message: 'Connexion requise.' }, 401);

  const key = stripeKey();
  const site = Deno.env.get('SITE_URL') ?? '';
  if (!key || !/^https?:\/\/[^\s]+$/.test(site)) return json({ error: 'billing_disabled', message: 'La facturation n\u2019est pas encore disponible.' }, 503);

  const { data: customer } = await adminClient().from('stripe_customers').select('stripe_customer_id').eq('user_id', auth.user.id).maybeSingle();
  if (!customer) return json({ error: 'no_customer', message: 'Aucun abonnement associé à votre compte.' }, 404);

  try {
    const session = await stripeRequest('/billing_portal/sessions', { customer: customer.stripe_customer_id, return_url: `${site}/premium` }, key);
    return json({ url: session.url });
  } catch (error) {
    return json({ error: 'stripe_error', message: error instanceof Error ? error.message : 'Erreur de facturation.' }, 502);
  }
});
