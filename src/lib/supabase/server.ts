import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { supabasePublishableKey, supabaseUrl } from '@/lib/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Client serveur lié à la session de l'utilisateur (cookies). Respecte la RLS.
 * Un seul client par requête (cache React) : moins de travail et d'allers-retours pour chaque page.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list: CookieToSet[]) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un Server Component : le middleware rafraîchit la session.
        }
      },
    },
  });
});
