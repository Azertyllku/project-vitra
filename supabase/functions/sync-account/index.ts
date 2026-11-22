import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient, userClient } from '../_shared/clients.ts';
import { connectors, type NormalizedMatch } from '../_shared/connectors.ts';

const MIN_INTERVAL_MS = 15 * 60 * 1000; // limite de fréquence par compte
const RESULTS = new Set(['win', 'loss', 'draw', 'unknown']);
const CHUNK = 100;

/** Validation stricte avant toute écriture : on n'enregistre jamais une donnée douteuse. */
function isValid(m: NormalizedMatch): boolean {
  const time = Date.parse(m.playedAt);
  return (
    typeof m.externalMatchId === 'string' &&
    m.externalMatchId.length > 0 &&
    m.externalMatchId.length <= 64 &&
    Number.isFinite(time) &&
    time > Date.parse('2000-01-01') &&
    time < Date.now() + 3_600_000 &&
    RESULTS.has(m.result) &&
    Object.values(m.stats).every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

/**
 * Synchronise l'historique d'un compte de jeu du membre connecté.
 * Authentification obligatoire ; le compte doit appartenir à l'appelant.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed', message: 'Méthode non autorisée.' }, 405);

  const { data: auth, error: authError } = await userClient(req).auth.getUser();
  if (authError || !auth.user) return json({ error: 'unauthorized', message: 'Connexion requise.' }, 401);

  const body = await req.json().catch(() => ({}));
  const accountId = typeof body.account_id === 'string' ? body.account_id : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) {
    return json({ error: 'bad_request', message: 'Compte invalide.' }, 400);
  }

  const admin = adminClient();
  const { data: account } = await admin
    .from('player_game_accounts')
    .select('id, profile_id, game_id, provider, external_id, region, game:games(slug)')
    .eq('id', accountId)
    .eq('profile_id', auth.user.id)
    .maybeSingle();
  if (!account) return json({ error: 'not_found', message: 'Compte introuvable.' }, 404);

  const connector = connectors[account.provider];
  if (!connector) {
    return json({ error: 'no_connector', message: 'Aucun connecteur n’est disponible pour ce type de compte. Vous pouvez saisir vos parties manuellement.' }, 501);
  }
  const game = Array.isArray(account.game) ? account.game[0] : account.game;
  if (game?.slug !== connector.gameSlug || !connector.validateExternalId(account.external_id)) {
    return json({ error: 'bad_account', message: 'Ce compte n’est pas compatible avec ce connecteur.' }, 400);
  }

  // Limite de fréquence : basée sur le journal, succès ou échec (protège aussi l'API tierce).
  const { data: lastLog } = await admin
    .from('data_sync_logs')
    .select('started_at')
    .eq('account_id', account.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastLog && Date.now() - Date.parse(lastLog.started_at) < MIN_INTERVAL_MS) {
    return json({ error: 'rate_limited', message: 'Dernière synchronisation il y a moins de 15 minutes. Réessayez plus tard.' }, 429);
  }

  const { data: log } = await admin
    .from('data_sync_logs')
    .insert({ account_id: account.id, profile_id: account.profile_id, provider: account.provider, status: 'running' })
    .select('id')
    .single();

  const finish = (fields: Record<string, unknown>) =>
    log ? admin.from('data_sync_logs').update({ ...fields, finished_at: new Date().toISOString() }).eq('id', log.id) : Promise.resolve();

  try {
    const fetched = await connector.fetchMatches({ externalId: account.external_id, region: account.region });
    const valid = fetched.filter(isValid);

    const rows = valid.map((m) => ({
      profile_id: account.profile_id,
      account_id: account.id,
      game_id: account.game_id,
      external_match_id: m.externalMatchId,
      played_at: m.playedAt,
      duration_seconds: m.durationSeconds ?? null,
      result: m.result,
      map_name: m.mapName ?? null,
      character_name: m.characterName ?? null,
      role_name: m.roleName ?? null,
      stats: m.stats,
      data_source: connector.dataSource,
    }));

    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      // Déduplication : une partie déjà importée est ignorée (clé unique account_id + external_match_id + played_at).
      const { data, error } = await admin
        .from('player_match_history')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'account_id,external_match_id,played_at', ignoreDuplicates: true })
        .select('id');
      if (error) throw new Error('Écriture de l’historique impossible.');
      inserted += data?.length ?? 0;
    }

    await admin.from('player_game_accounts').update({ last_synced_at: new Date().toISOString() }).eq('id', account.id);
    await finish({ status: 'success', fetched_count: fetched.length, inserted_count: inserted });
    return json({ fetched: fetched.length, rejected: fetched.length - valid.length, inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue.';
    await finish({ status: 'error', error_message: message.slice(0, 500) });
    return json({ error: 'sync_failed', message }, 502);
  }
});
