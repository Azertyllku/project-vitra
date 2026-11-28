'use server';

import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type DeleteState = { error: string | null };

/**
 * Suppression d'un compte (droit à l'effacement). Confirmation par saisie du pseudo ; les données liées disparaissent en cascade
 * (profil, performances, publications, messages…). Le dernier super administrateur ne peut pas se supprimer.
 */
export async function deleteAccount(_previous: DeleteState, form: FormData): Promise<DeleteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Connexion requise.' };

  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle<{ username: string }>();
  const typed = String(form.get('confirmation') ?? '').trim();
  if (!profile || typed.toLowerCase() !== profile.username.toLowerCase()) return { error: 'Saisissez votre pseudo exactement pour confirmer.' };

  const admin = (() => {
    try {
      return adminClient();
    } catch {
      return null;
    }
  })();
  if (!admin) return { error: 'Suppression indisponible : configuration du serveur incomplète.' };

  const { data: mine } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin');
  if ((mine ?? []).length > 0) {
    const { count } = await admin.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'super_admin');
    if ((count ?? 0) <= 1) return { error: 'Vous êtes le dernier super administrateur : attribuez ce rôle à un autre membre avant de supprimer votre compte.' };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: 'La suppression a échoué, réessayez plus tard.' };
  try {
    await supabase.auth.signOut();
  } catch {
    // la session est déjà invalide : sans conséquence
  }
  redirect('/confidentialite?compte=supprime');
}
