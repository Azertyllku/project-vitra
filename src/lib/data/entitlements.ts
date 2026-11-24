import { createClient } from '@/lib/supabase/server';

export interface Entitlements {
  userId: string | null;
  isPremium: boolean;
  isStaff: boolean;
}

/**
 * Droits de l'utilisateur connecté. Premium = rôle `premium` (attribué par le webhook Stripe), `admin` ou `super_admin`.
 * Les rôles sont lus avec la RLS : chacun ne voit que les siens.
 */
export async function getEntitlements(): Promise<Entitlements> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, isPremium: false, isStaff: false };
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).returns<{ role: string }[]>();
  const roles = (data ?? []).map((r) => r.role);
  return {
    userId: user.id,
    isPremium: roles.some((r) => ['premium', 'admin', 'super_admin'].includes(r)),
    isStaff: roles.some((r) => ['editor', 'admin', 'super_admin'].includes(r)),
  };
}
