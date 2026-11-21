import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const { error } = await adminClient().from('games').select('id', { head: true, count: 'exact' });
  return json({ status: error ? 'degraded' : 'ok', database: error ? 'unreachable' : 'ok', time: new Date().toISOString() }, error ? 503 : 200);
});
