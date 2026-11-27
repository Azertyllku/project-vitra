import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteEntity, saveEntity } from '@/app/admin/actions';
import { AdminDeleteButton } from '@/components/admin-delete-button';
import { AdminForm } from '@/components/admin-form';
import { Card, PageHeader } from '@/components/ui';
import { ENTITIES, type Option } from '@/lib/admin/entities';
import { isoToParisInput } from '@/lib/admin/time';
import { one } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { entity } = await params;
  return { title: ENTITIES[entity] ? `${ENTITIES[entity].plural} — édition` : 'Administration' };
}

const ERRORS: Record<string, string> = {
  lie: 'Suppression impossible : des données (matchs, équipes…) sont encore liées à cet élément.',
  droits: 'Suppression réservée aux administrateurs.',
};

export default async function AdminEditPage({ params, searchParams }: Props) {
  const { entity: key, id } = await params;
  const entity = ENTITIES[key];
  if (!entity) notFound();
  const isNew = id === 'nouveau';
  if (!isNew && !UUID.test(id)) notFound();
  const sp = await searchParams;
  const supabase = await createClient();

  let row: Record<string, unknown> | null = null;
  const teamsBySlot: Record<number, { team_id: string | null; score: number | null }> = {};
  if (!isNew) {
    const { data } = await supabase.from(entity.table).select('*').eq('id', id).maybeSingle<Record<string, unknown>>();
    if (!data) notFound();
    row = data;
    if (entity.key === 'matchs') {
      const { data: slots } = await supabase.from('match_teams').select('slot, team_id, score').eq('match_id', id).returns<{ slot: number; team_id: string | null; score: number | null }[]>();
      for (const slot of slots ?? []) teamsBySlot[slot.slot] = { team_id: slot.team_id, score: slot.score };
    }
  }

  const values: Record<string, string | boolean> = {};
  for (const field of entity.fields) {
    let value: unknown;
    if (field.virtual) {
      const slot = field.name.endsWith('1') ? 1 : 2;
      value = field.name.startsWith('team') ? teamsBySlot[slot]?.team_id : teamsBySlot[slot]?.score;
    } else {
      value = row ? row[field.name] : field.default;
    }
    if (field.type === 'checkbox') values[field.name] = Boolean(value);
    else if (field.type === 'datetime') values[field.name] = isoToParisInput(value);
    else values[field.name] = value == null ? '' : String(value);
  }

  const options: Record<string, Option[]> = {};
  const byTable = new Map<string, Option[]>();
  for (const field of entity.fields) {
    if (!field.relation) continue;
    const { table, label } = field.relation;
    if (!byTable.has(table)) {
      const { data } = await supabase.from(table).select(`id, ${label}`).order(label).limit(500).returns<Record<string, string>[]>();
      byTable.set(table, (data ?? []).map((item) => ({ value: item.id, label: item[label] })));
    }
    options[field.name] = byTable.get(table) ?? [];
  }

  const error = ERRORS[one(sp.erreur) ?? ''];
  const title = isNew ? `Ajouter — ${entity.plural}` : `Modifier — ${entity.plural}`;

  return (
    <>
      <PageHeader title={title}>
        <Link href={`/admin/${key}`} className="text-sm text-[var(--accent-blue)] hover:underline">← {entity.plural}</Link>
      </PageHeader>
      {error && <p role="alert" className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <Card className="p-6">
        <AdminForm
          action={saveEntity.bind(null, key, isNew ? null : id)}
          fields={entity.fields}
          values={values}
          options={options}
          submitLabel={isNew ? 'Créer' : 'Enregistrer'}
        />
      </Card>
      {!isNew && (
        <div className="mt-8 flex justify-end">
          <AdminDeleteButton action={deleteEntity.bind(null, key, id)} label="cet élément" />
        </div>
      )}
    </>
  );
}
