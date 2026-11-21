import { createBrowserClient } from '@supabase/ssr';
import { supabasePublishableKey, supabaseUrl } from '@/lib/env';

/** Client navigateur : clé publique uniquement, protégé par la RLS. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
