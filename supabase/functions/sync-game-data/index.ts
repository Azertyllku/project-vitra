import { corsHeaders, json } from '../_shared/cors.ts';
import { requireStaff } from '../_shared/auth.ts';
import { connectors } from '../_shared/connectors.ts';

/**
 * Point d'entrée des synchronisations. Réservé au staff.
 * Corps : { "provider": "riot" }. Un fournisseur sans connecteur répond 501 :
 * on ne simule jamais de données.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  const staff = await requireStaff(req);
  if (!staff) return json({ error: 'Accès refusé' }, 403);

  const { provider } = await req.json().catch(() => ({ provider: undefined }));
  if (typeof provider !== 'string') return json({ error: 'provider requis' }, 400);

  const connector = connectors[provider];
  if (!connector) return json({ error: `Aucun connecteur implémenté pour « ${provider} »` }, 501);

  return json({ provider, capabilities: connector.capabilities, status: 'ready' });
});
