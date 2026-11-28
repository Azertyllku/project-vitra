'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/admin/entities';
import { logAdmin } from '@/lib/admin/log';
import { parisInputToIso } from '@/lib/admin/time';
import { getViewer } from '@/lib/data/community';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = ['member', 'premium', 'creator', 'editor', 'admin', 'super_admin'];
const fail = (message: string, fieldErrors?: Record<string, string>): FormState => ({ ok: false, message, fieldErrors });
const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/** Attribue un rôle. Réservé aux super administrateurs (règle de la base : un refus remonte comme erreur de droits). */
export async function grantRole(userId: string, _previous: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return fail('Accès réservé à l’équipe.');
  if (!UUID.test(userId)) return fail('Membre invalide.');
  const role = text(form, 'role');
  if (!ROLES.includes(role)) return fail('Corrigez les champs signalés.', { role: 'Choix invalide.' });

  const supabase = await createClient();
  const { error } = await supabase.from('user_roles').insert({ user_id: userId, role, granted_by: viewer.id });
  if (error) {
    if (error.code === '23505') return fail('Ce rôle est déjà attribué.');
    return fail(error.code === '42501' ? 'Seuls les super administrateurs peuvent attribuer des rôles.' : 'Attribution impossible.');
  }
  await logAdmin(supabase, viewer.id, 'grant_role', 'user_roles', userId, `Rôle ${role} accordé`);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { ok: true, message: 'Rôle attribué.' };
}

/** Retire un rôle (super administrateurs). On ne peut pas retirer son propre rôle de super administrateur. */
export async function revokeRole(userId: string, role: string): Promise<void> {
  const viewer = await getViewer();
  if (!viewer?.isStaff || !UUID.test(userId) || !ROLES.includes(role)) redirect('/admin/utilisateurs');
  if (userId === viewer.id && role === 'super_admin') redirect(`/admin/utilisateurs/${userId}?erreur=soi`);
  const supabase = await createClient();
  const { data, error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role).select('role');
  if (error || !data || data.length === 0) redirect(`/admin/utilisateurs/${userId}?erreur=droits`);
  await logAdmin(supabase, viewer.id, 'revoke_role', 'user_roles', userId, `Rôle ${role} retiré`);
  redirect(`/admin/utilisateurs/${userId}?ok=role`);
}

/** Mise en sourdine ou bannissement (bloque la publication). Une date de fin vide rend la sanction permanente. */
export async function addSanction(userId: string, _previous: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return fail('Accès réservé à l’équipe.');
  if (!UUID.test(userId)) return fail('Membre invalide.');
  if (userId === viewer.id) return fail('Vous ne pouvez pas vous sanctionner vous-même.');

  const errors: Record<string, string> = {};
  const kind = text(form, 'kind');
  if (kind !== 'mute' && kind !== 'ban') errors.kind = 'Choix invalide.';
  const reason = text(form, 'reason');
  if (!reason) errors.reason = 'Motif obligatoire.';
  else if (reason.length > 500) errors.reason = '500 caractères maximum.';
  let until: string | null = null;
  const untilText = text(form, 'until');
  if (untilText) {
    until = parisInputToIso(untilText);
    if (!until) errors.until = 'Date invalide.';
    else if (new Date(until).getTime() <= Date.now()) errors.until = 'La date de fin doit être dans le futur.';
  }
  if (Object.keys(errors).length) return fail('Corrigez les champs signalés.', errors);

  const supabase = await createClient();
  const { error } = await supabase.from('user_sanctions').insert({ user_id: userId, kind, reason, until, created_by: viewer.id });
  if (error) return fail(error.code === '42501' ? 'Droits insuffisants.' : 'Sanction impossible, réessayez.');
  await logAdmin(supabase, viewer.id, 'sanction', 'user_sanctions', userId, `${kind === 'ban' ? 'Bannissement' : 'Sourdine'} : ${reason}`);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { ok: true, message: 'Sanction enregistrée.' };
}

export async function liftSanction(userId: string, sanctionId: string): Promise<void> {
  const viewer = await getViewer();
  if (!viewer?.isStaff || !UUID.test(userId) || !UUID.test(sanctionId)) redirect('/admin/utilisateurs');
  const supabase = await createClient();
  const { data, error } = await supabase.from('user_sanctions').delete().eq('id', sanctionId).eq('user_id', userId).select('id');
  if (error || !data || data.length === 0) redirect(`/admin/utilisateurs/${userId}?erreur=droits`);
  await logAdmin(supabase, viewer.id, 'lift_sanction', 'user_sanctions', userId, 'Sanction levée');
  redirect(`/admin/utilisateurs/${userId}?ok=leve`);
}

/** Modifie un réglage de la plateforme (valeur JSON). Réservé aux administrateurs par la RLS. */
export async function saveSetting(key: string, _previous: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return fail('Accès réservé à l’équipe.');
  const raw = text(form, 'value');
  if (!raw) return fail('Corrigez les champs signalés.', { value: 'Valeur obligatoire.' });
  if (raw.length > 4000) return fail('Corrigez les champs signalés.', { value: '4000 caractères maximum.' });
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail('Corrigez les champs signalés.', { value: 'JSON invalide (exemples : true, 42, "texte", {"a": 1}).' });
  }
  const isPublic = form.getAll('is_public').includes('on');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('platform_settings')
    .update({ value, is_public: isPublic, updated_by: viewer.id, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select('key');
  if (error) return fail('Enregistrement impossible, réessayez.');
  if (!data || data.length === 0) return fail('Modification réservée aux administrateurs.');
  await logAdmin(supabase, viewer.id, 'setting', 'platform_settings', key, `Réglage ${key} modifié`);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Réglage enregistré.' };
}
