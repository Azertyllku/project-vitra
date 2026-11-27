'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { ENTITIES, type EntityConfig, type FormState } from '@/lib/admin/entities';
import { parisInputToIso } from '@/lib/admin/time';
import { getViewer } from '@/lib/data/community';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const slugify = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const fail = (message: string, fieldErrors?: Record<string, string>): FormState => ({ ok: false, message, fieldErrors });

function dbError(error: { code?: string }): FormState {
  if (error.code === '23505') return fail('Cette valeur existe déjà (identifiant d’URL déjà utilisé ?).');
  if (error.code === '23503') return fail('Référence invalide ou données liées.');
  if (error.code === '23514') return fail('Une valeur est refusée par la base (dates incohérentes, format invalide…).');
  if (error.code === '42501') return fail('Droits insuffisants.');
  return fail('Enregistrement impossible, réessayez.');
}

function parseFields(entity: EntityConfig, form: FormData) {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const raw = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };

  for (const field of entity.fields) {
    if (field.virtual) continue;
    const text = raw(field.name);

    if (field.type === 'checkbox') {
      values[field.name] = form.getAll(field.name).includes('on');
      continue;
    }
    if (field.type === 'slug') {
      const slug = text || (entity.slugFrom ? slugify(raw(entity.slugFrom)) : '');
      if (!slug) errors[field.name] = 'Identifiant d’URL impossible à déduire : renseignez-le.';
      else if (!/^[a-z0-9-]+$/.test(slug)) errors[field.name] = 'Lettres minuscules, chiffres et tirets uniquement.';
      else values[field.name] = slug;
      continue;
    }
    if (!text) {
      if (field.required) errors[field.name] = 'Champ obligatoire.';
      else values[field.name] = null;
      continue;
    }

    switch (field.type) {
      case 'text':
      case 'textarea': {
        const max = field.max ?? (field.type === 'textarea' ? 4000 : 200);
        if (text.length > max) errors[field.name] = `${max} caractères maximum.`;
        else values[field.name] = text;
        break;
      }
      case 'url':
        if (!/^https?:\/\/\S+$/i.test(text) || text.length > 500) errors[field.name] = 'URL http(s) valide attendue.';
        else values[field.name] = text;
        break;
      case 'country':
        if (!/^[A-Za-z]{2}$/.test(text)) errors[field.name] = 'Code à 2 lettres (ex. FR).';
        else values[field.name] = text.toUpperCase();
        break;
      case 'currency':
        if (!/^[A-Za-z]{3}$/.test(text)) errors[field.name] = 'Code à 3 lettres (ex. EUR).';
        else values[field.name] = text.toUpperCase();
        break;
      case 'color':
        if (!/^#[0-9A-Fa-f]{6}$/.test(text)) errors[field.name] = 'Format #RRGGBB attendu.';
        else values[field.name] = text;
        break;
      case 'number':
      case 'integer': {
        const number = Number(text.replace(',', '.'));
        if (!Number.isFinite(number) || (field.type === 'integer' && !Number.isInteger(number))) errors[field.name] = 'Nombre valide attendu.';
        else if (field.min != null && number < field.min) errors[field.name] = `Minimum : ${field.min}.`;
        else if (field.max != null && number > field.max) errors[field.name] = `Maximum : ${field.max}.`;
        else values[field.name] = number;
        break;
      }
      case 'datetime': {
        const iso = parisInputToIso(text);
        if (!iso) errors[field.name] = 'Date invalide.';
        else values[field.name] = iso;
        break;
      }
      case 'select':
        if (!field.options?.some((option) => option.value === text)) errors[field.name] = 'Choix invalide.';
        else values[field.name] = text;
        break;
      case 'relation':
        if (!UUID.test(text)) errors[field.name] = 'Sélection invalide.';
        else values[field.name] = text;
        break;
    }
  }

  if (entity.key === 'tournois' && typeof values.starts_at === 'string' && typeof values.ends_at === 'string' && values.ends_at < values.starts_at) {
    errors.ends_at = 'La fin doit être après le début.';
  }
  return { values, errors };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Les deux équipes et scores d'un match (table match_teams) ; le vainqueur est déduit des scores d'un match terminé. */
async function saveMatchTeams(supabase: Supabase, matchId: string, form: FormData, status: string): Promise<FormState | null> {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const errors: Record<string, string> = {};
  const team = (name: string) => {
    const value = text(name);
    if (!value) return null;
    if (!UUID.test(value)) errors[name] = 'Sélection invalide.';
    return value;
  };
  const score = (name: string) => {
    const value = text(name);
    if (!value) return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 999) errors[name] = 'Entier entre 0 et 999.';
    return number;
  };
  const t1 = team('team1');
  const t2 = team('team2');
  const s1 = score('score1');
  const s2 = score('score2');
  if (t1 && t2 && t1 === t2) errors.team2 = 'Les deux équipes doivent être différentes.';
  if (Object.keys(errors).length) return fail('Corrigez les champs signalés.', errors);

  const decided = status === 'finished' && s1 != null && s2 != null && s1 !== s2;
  const rows = [
    { match_id: matchId, slot: 1, team_id: t1, score: s1, is_winner: decided ? (s1 as number) > (s2 as number) : false },
    { match_id: matchId, slot: 2, team_id: t2, score: s2, is_winner: decided ? (s2 as number) > (s1 as number) : false },
  ];
  const { error } = await supabase.from('match_teams').upsert(rows, { onConflict: 'match_id,slot' });
  return error ? dbError(error) : null;
}

function refreshSite(entity: EntityConfig) {
  if (entity.table === 'games') revalidateTag('games');
  revalidatePath('/', 'layout');
}

/** Crée (id = null) ou modifie un élément. La RLS réserve l'écriture au staff ; le contrôle ici donne un message clair. */
export async function saveEntity(key: string, id: string | null, _previous: FormState, form: FormData): Promise<FormState> {
  const entity = ENTITIES[key];
  if (!entity) return fail('Type de contenu inconnu.');
  const viewer = await getViewer();
  if (!viewer?.isStaff) return fail('Accès réservé à l’équipe.');
  if (id && !UUID.test(id)) return fail('Identifiant invalide.');

  const { values, errors } = parseFields(entity, form);
  if (Object.keys(errors).length) return fail('Corrigez les champs signalés.', errors);

  const supabase = await createClient();

  if (entity.key === 'matchs') {
    const status = String(values.status);
    const previous = id ? (await supabase.from('matches').select('status, started_at, ended_at').eq('id', id).maybeSingle<{ status: string; started_at: string | null; ended_at: string | null }>()).data : null;
    const now = new Date().toISOString();
    if (status === 'live' && !previous?.started_at) values.started_at = now;
    if (status === 'finished' && !previous?.ended_at) values.ended_at = now;
  }

  let rowId = id;
  if (id) {
    const { data, error } = await supabase.from(entity.table).update(values).eq('id', id).select('id');
    if (error) return dbError(error);
    if (!data || data.length === 0) return fail('Modification refusée ou élément introuvable.');
  } else {
    const { data, error } = await supabase.from(entity.table).insert(values).select('id').single<{ id: string }>();
    if (error) return dbError(error);
    rowId = data.id;
  }

  if (entity.key === 'matchs' && rowId) {
    const problem = await saveMatchTeams(supabase, rowId, form, String(values.status));
    if (problem) return problem;
  }

  refreshSite(entity);
  if (!id) redirect(`/admin/${key}`);
  return { ok: true, message: 'Modifications enregistrées.' };
}

/** Suppression (réservée aux administrateurs par la RLS). */
export async function deleteEntity(key: string, id: string): Promise<void> {
  const entity = ENTITIES[key];
  const viewer = await getViewer();
  if (!entity || !viewer?.isStaff || !UUID.test(id)) redirect('/admin');
  const supabase = await createClient();
  const { data, error } = await supabase.from(entity.table).delete().eq('id', id).select('id');
  if (error) redirect(`/admin/${key}/${id}?erreur=lie`);
  if (!data || data.length === 0) redirect(`/admin/${key}/${id}?erreur=droits`);
  refreshSite(entity);
  redirect(`/admin/${key}`);
}
