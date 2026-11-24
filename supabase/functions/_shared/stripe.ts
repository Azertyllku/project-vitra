const API = 'https://api.stripe.com/v1';

export function stripeKey(): string | null {
  return Deno.env.get('STRIPE_SECRET_KEY') ?? null;
}

/** Appel POST de l'API Stripe (formulaire encodé) sans SDK. */
// deno-lint-ignore no-explicit-any
export async function stripeRequest(path: string, params: Record<string, string>, key: string): Promise<any> {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? 'Erreur Stripe');
  return data;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vérifie l'en-tête Stripe-Signature (schéma v1 : HMAC-SHA256 de "<t>.<corps brut>"), avec tolérance
 * d'horodatage (rejeu) et comparaison à temps constant.
 */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300, nowMs = Date.now()): Promise<boolean> {
  if (!header || !secret) return false;
  const pairs = header.split(',').map((part) => part.trim().split('='));
  const timestamp = pairs.find(([key]) => key === 't')?.[1];
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(nowMs / 1000 - seconds) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}
