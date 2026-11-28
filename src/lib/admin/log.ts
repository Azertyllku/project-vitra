import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

export type AdminAction = 'create' | 'update' | 'delete' | 'grant_role' | 'revoke_role' | 'sanction' | 'lift_sanction' | 'setting';

/**
 * Inscrit une action d'administration dans le journal (table admin_logs).
 * Au mieux : une échec d'écriture du journal ne doit jamais bloquer l'action elle-même.
 */
export async function logAdmin(supabase: Client, actorId: string, action: AdminAction, targetType: string, targetId: string | null, summary: string): Promise<void> {
  try {
    await supabase.from('admin_logs').insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, summary: summary.slice(0, 300) });
  } catch {
    // volontairement ignoré
  }
}
