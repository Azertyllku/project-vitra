import { json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { verifyStripeSignature } from '../_shared/stripe.ts';

/**
 * Webhook Stripe : seule source de vérité pour les abonnements, paiements et le rôle Premium.
 * - signature vérifiée (HMAC, tolérance anti-rejeu) avant tout traitement ;
 * - idempotent (table stripe_events) ; en cas d'échec de traitement l'événement est réouvert et Stripe réessaiera ;
 * - l'abonnement est relu auprès de Stripe (état le plus récent) pour éviter les événements arrivés dans le désordre.
 * Déploiement : verify_jwt = false (Stripe n'envoie pas de JWT Supabase ; l'authenticité repose sur la signature).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused']);
const GRANTING = new Set(['active', 'trialing', 'past_due']); // past_due : délai de grâce pendant les relances de paiement

type Admin = ReturnType<typeof adminClient>;
// deno-lint-ignore no-explicit-any
type Obj = any;

const iso = (seconds: unknown) => (typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null);
const idOf = (value: unknown): string | null => (typeof value === 'string' ? value : ((value as { id?: string } | null)?.id ?? null));

async function resolveUser(admin: Admin, customerId: string | null, metadataUserId?: string): Promise<string | null> {
  if (customerId) {
    const { data } = await admin.from('stripe_customers').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    if (data) return data.user_id;
  }
  if (metadataUserId && UUID.test(metadataUserId) && customerId) {
    const { data: profile } = await admin.from('profiles').select('id').eq('id', metadataUserId).maybeSingle();
    if (profile) {
      await admin.from('stripe_customers').upsert({ user_id: profile.id, stripe_customer_id: customerId }, { onConflict: 'user_id', ignoreDuplicates: true });
      return profile.id;
    }
  }
  return null;
}

async function syncPremiumRole(admin: Admin, userId: string) {
  const { data: subs } = await admin.from('subscriptions').select('status').eq('user_id', userId);
  const grant = (subs ?? []).some((s: { status: string }) => GRANTING.has(s.status));
  if (grant) {
    const { error } = await admin.from('user_roles').upsert({ user_id: userId, role: 'premium' }, { onConflict: 'user_id,role', ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await admin.from('user_roles').delete().eq('user_id', userId).eq('role', 'premium');
    if (error) throw error;
  }
}

async function latestSubscription(id: string, fallback: Obj): Promise<Obj> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return fallback;
  try {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    return response.ok ? await response.json() : fallback;
  } catch {
    return fallback;
  }
}

async function syncSubscription(admin: Admin, payload: Obj, deleted: boolean) {
  const sub = await latestSubscription(payload.id, payload);
  const customerId = idOf(sub.customer);
  const userId = await resolveUser(admin, customerId, sub.metadata?.user_id);
  if (!userId || !customerId) return; // abonnement sans membre identifiable : ignoré
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id;
  const { data: plan } = priceId ? await admin.from('subscription_plans').select('id').eq('stripe_price_id', priceId).maybeSingle() : { data: null };
  const status = deleted ? 'canceled' : STATUSES.has(sub.status) ? sub.status : 'incomplete';
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    plan_id: plan?.id ?? null,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    status,
    // L'échéance a été déplacée sur l'élément d'abonnement dans les versions récentes de l'API Stripe.
    current_period_end: iso(sub.current_period_end ?? item?.current_period_end),
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  }, { onConflict: 'stripe_subscription_id' });
  if (error) throw error;
  await syncPremiumRole(admin, userId);
}

async function recordInvoice(admin: Admin, invoice: Obj, status: 'paid' | 'failed') {
  const customerId = idOf(invoice.customer);
  const userId = customerId ? await resolveUser(admin, customerId) : null;
  const stripeSubId = idOf(invoice.subscription ?? invoice.parent?.subscription_details?.subscription);
  const { data: sub } = stripeSubId ? await admin.from('subscriptions').select('id').eq('stripe_subscription_id', stripeSubId).maybeSingle() : { data: null };
  const { error } = await admin.from('payments').upsert({
    user_id: userId,
    subscription_id: sub?.id ?? null,
    stripe_invoice_id: invoice.id,
    amount_cents: Number(status === 'paid' ? invoice.amount_paid : invoice.amount_due) || 0,
    currency: String(invoice.currency ?? 'eur').toUpperCase().slice(0, 3),
    status,
    hosted_invoice_url: typeof invoice.hosted_invoice_url === 'string' ? invoice.hosted_invoice_url : null,
    paid_at: iso(invoice.status_transitions?.paid_at),
  }, { onConflict: 'stripe_invoice_id' });
  if (error) throw error;
}

async function handle(admin: Admin, event: Obj) {
  const object = event.data?.object ?? {};
  switch (event.type) {
    case 'checkout.session.completed': {
      const customerId = idOf(object.customer);
      const userId = typeof object.client_reference_id === 'string' && UUID.test(object.client_reference_id) ? object.client_reference_id : null;
      if (customerId && userId) await resolveUser(admin, customerId, userId);
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscription(admin, object, false);
      break;
    case 'customer.subscription.deleted':
      await syncSubscription(admin, object, true);
      break;
    case 'invoice.paid':
      await recordInvoice(admin, object, 'paid');
      break;
    case 'invoice.payment_failed':
      await recordInvoice(admin, object, 'failed');
      break;
    default:
      break; // événements non utilisés : accusés sans traitement
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'webhook_not_configured' }, 503);

  const raw = await req.text();
  if (!(await verifyStripeSignature(raw, req.headers.get('stripe-signature'), secret))) return json({ error: 'invalid_signature' }, 400);

  let event: Obj;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_payload' }, 400);
  }
  if (typeof event?.id !== 'string' || typeof event?.type !== 'string') return json({ error: 'invalid_payload' }, 400);

  const admin = adminClient();
  const { error: duplicate } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (duplicate) return duplicate.code === '23505' ? json({ received: true, duplicate: true }) : json({ error: 'storage_error' }, 500);

  try {
    await handle(admin, event);
  } catch {
    await admin.from('stripe_events').delete().eq('id', event.id); // permet le nouvel essai de Stripe
    return json({ error: 'processing_failed' }, 500);
  }
  return json({ received: true });
});
