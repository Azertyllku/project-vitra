import { adminClient, userClient } from './clients.ts';

/** Vérifie que l'appelant est connecté ET staff (editor, admin, super_admin). */
export async function requireStaff(req: Request): Promise<{ userId: string } | null> {
  const { data, error } = await userClient(req).auth.getUser();
  if (error || !data.user) return null;
  const { data: roles } = await adminClient()
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id)
    .in('role', ['editor', 'admin', 'super_admin']);
  return roles && roles.length > 0 ? { userId: data.user.id } : null;
}
