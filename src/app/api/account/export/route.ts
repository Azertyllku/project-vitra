import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const LIMIT = 5000;

/** Tables propres au membre : [table, colonne qui désigne le membre]. */
const OWN: [string, string][] = [
  ['profiles', 'id'],
  ['user_preferences', 'user_id'],
  ['user_roles', 'user_id'],
  ['player_game_accounts', 'profile_id'],
  ['player_match_history', 'profile_id'],
  ['player_rank_history', 'profile_id'],
  ['data_sync_logs', 'profile_id'],
  ['posts', 'author_id'],
  ['comments', 'author_id'],
  ['reactions', 'user_id'],
  ['community_members', 'user_id'],
  ['chat_messages', 'user_id'],
  ['user_notifications', 'user_id'],
  ['user_favorites', 'user_id'],
  ['video_favorites', 'user_id'],
  ['video_views', 'user_id'],
  ['playlists', 'user_id'],
  ['user_blocks', 'blocker_id'],
  ['user_dashboards', 'user_id'],
  ['ai_reports', 'user_id'],
  ['user_sanctions', 'user_id'],
];

type Result = PromiseLike<{ data: unknown; error: unknown }>;

/** Export des données personnelles du membre connecté (droit d'accès et de portabilité), lues avec ses propres droits. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const run = async (key: string, query: Result) => {
    const { data, error } = await query;
    return [key, error ? { erreur: 'données inaccessibles avec vos droits' } : data] as const;
  };

  const entries = await Promise.all([
    ...OWN.map(([table, column]) => run(table, supabase.from(table).select('*').eq(column, user.id).limit(LIMIT))),
    run('abonnements', supabase.from('follows').select('followed_id, created_at').eq('follower_id', user.id).limit(LIMIT)),
    run('abonnes', supabase.from('follows').select('follower_id, created_at').eq('followed_id', user.id).limit(LIMIT)),
    run('messages_prives', supabase.from('messages').select('*').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).limit(LIMIT)),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    notice: `Export de vos données personnelles (limite de ${LIMIT} lignes par tableau). Les tableaux inaccessibles avec vos droits sont signalés.`,
    account: { id: user.id, email: user.email, created_at: user.created_at },
    data: Object.fromEntries(entries),
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="esport-hub-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
