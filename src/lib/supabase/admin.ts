import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/env';

/**
 * Client avec la clé service_role : CONTOURNE la RLS.
 * Réservé au serveur (import 'server-only' : le build échoue s'il est importé côté navigateur).
 * À n'utiliser que pour des tâches système (imports, synchronisations), jamais pour répondre
 * directement à une requête utilisateur sans contrôle d'autorisation préalable.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante (serveur uniquement)');
  return createSupabaseClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
