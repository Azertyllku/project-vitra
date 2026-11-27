import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/env';

/**
 * Client "service" (contourne la RLS) : à réserver aux routes serveur qui ont déjà vérifié l'identité de l'utilisateur,
 * par exemple pour marquer un compte de jeu comme vérifié. Ne jamais l'importer dans un composant client.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Variable d\'environnement manquante : SUPABASE_SERVICE_ROLE_KEY (voir .env.example)');
  return createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
