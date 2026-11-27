import { adminClient } from '@/lib/supabase/admin';
import type { Identity } from './identity';

export type LinkResult = { ok: true } | { ok: false; error: 'jeu' | 'deja' | 'echec' };

/**
 * Enregistre un compte de jeu comme VÉRIFIÉ pour un membre dont l'identité a été prouvée par le fournisseur.
 * Utilise le client service : la RLS interdit aux membres de se déclarer eux-mêmes "vérifiés".
 * Un index unique garantit qu'un compte de jeu n'est vérifié que pour un seul membre.
 */
export async function linkVerifiedAccount(input: { profileId: string; gameSlug: string } & Identity): Promise<LinkResult> {
  const admin = adminClient();
  const { data: game } = await admin.from('games').select('id').eq('slug', input.gameSlug).maybeSingle<{ id: string }>();
  if (!game) return { ok: false, error: 'jeu' };

  const { data: verified } = await admin
    .from('player_game_accounts')
    .select('id, profile_id')
    .eq('game_id', game.id)
    .eq('provider', input.provider)
    .eq('external_id', input.externalId)
    .eq('verification_status', 'verified')
    .maybeSingle<{ id: string; profile_id: string }>();
  if (verified && verified.profile_id !== input.profileId) return { ok: false, error: 'deja' };

  const { data: own } = await admin
    .from('player_game_accounts')
    .select('id')
    .eq('profile_id', input.profileId)
    .eq('game_id', game.id)
    .eq('provider', input.provider)
    .eq('external_id', input.externalId)
    .maybeSingle<{ id: string }>();

  const proof = { verification_status: 'verified', data_source: 'official', ...(input.displayName ? { display_name: input.displayName } : {}) };

  if (own) {
    const { error } = await admin.from('player_game_accounts').update(proof).eq('id', own.id);
    if (error) return { ok: false, error: error.code === '23505' ? 'deja' : 'echec' };
    return { ok: true };
  }

  const { data: player } = await admin.from('players').select('id').eq('profile_id', input.profileId).maybeSingle<{ id: string }>();
  const { error } = await admin.from('player_game_accounts').insert({
    profile_id: input.profileId,
    player_id: player?.id ?? null,
    game_id: game.id,
    provider: input.provider,
    external_id: input.externalId,
    ...proof,
  });
  if (error) return { ok: false, error: error.code === '23505' ? 'deja' : 'echec' };
  return { ok: true };
}
