'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { readFunctionError } from '@/lib/function-error';

/** N'accepte qu'une redirection vers un domaine Stripe (aucune redirection ouverte). */
function stripeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com')) ? url.toString() : null;
  } catch {
    return null;
  }
}

const primary = 'rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium hover:brightness-110 disabled:opacity-60';

function useStripeRedirect(functionName: string, body: Record<string, unknown>, loggedIn: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (!loggedIn) {
      router.push('/connexion?next=/premium');
      return;
    }
    setPending(true);
    setError(null);
    const { data, error: failure } = await createClient().functions.invoke(functionName, { body });
    if (failure) {
      setError(await readFunctionError(failure, 'Le service de paiement est indisponible pour le moment.'));
      setPending(false);
      return;
    }
    const target = stripeUrl(data?.url);
    if (!target) {
      setError('Réponse inattendue du service de paiement.');
      setPending(false);
      return;
    }
    window.location.href = target;
  }
  return { pending, error, go };
}

export function SubscribeButton({ planCode, loggedIn, children }: { planCode: string; loggedIn: boolean; children: ReactNode }) {
  const { pending, error, go } = useStripeRedirect('create-checkout-session', { plan_code: planCode }, loggedIn);
  return (
    <div>
      <button type="button" onClick={go} disabled={pending} className={primary}>{pending ? 'Redirection…' : children}</button>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

export function PortalButton() {
  const { pending, error, go } = useStripeRedirect('create-portal-session', {}, true);
  return (
    <div>
      <button type="button" onClick={go} disabled={pending} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60">
        {pending ? 'Ouverture…' : 'Gérer mon abonnement'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
