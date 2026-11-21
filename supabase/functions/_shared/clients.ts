import { createClient } from 'jsr:@supabase/supabase-js@2';

// SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont injectées automatiquement
// dans les Edge Functions : aucun secret à écrire dans le code.
const url = Deno.env.get('SUPABASE_URL')!;

/** Client système (contourne la RLS) : imports et synchronisations uniquement. */
export const adminClient = () =>
  createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** Client agissant au nom de l'appelant (respecte la RLS). */
export const userClient = (req: Request) =>
  createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
