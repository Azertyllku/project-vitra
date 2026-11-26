import { createClient } from '@/lib/supabase/server';

export interface Entitlements {
  userId: string | null;
  isStaff: boolean;
}

/**
 * Droits de l'utilisateur connecté. Le projet est gratuit : toutes les fonctionnalités (statistiques avancées,
 * rapports IA, tableau de bord, alertes) sont ouvertes à tout membre connecté. Seul le rôle de staff reste distingué.
 * Les rôles sont lus avec la RLS : chacun ne voit que les siens.
 */
export async function getEntitlements(): Promise<Entitlements> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, isStaff: false };
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).returns<{ role: string }[]>();
  const roles = (data ?? []).map((r) => r.role);
  return {
    userId: user.id,
    isStaff: roles.some((r) => ['editor', 'admin', 'super_admin'].includes(r)),
  };
}
