import { createClient } from '@supabase/supabase-js';
import { supabasePublishableKey, supabaseUrl } from '@/lib/env';

/**
 * Client anonyme sans cookies, pour les données publiques mises en cache (catalogue des jeux, etc.).
 * Ne jamais l'utiliser pour des données propres à un membre : il n'a pas de session.
 */
export const publicClient = () =>
  createClient(supabaseUrl(), supabasePublishableKey(), { auth: { persistSession: false, autoRefreshToken: false } });
