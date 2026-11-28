import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { ENTITIES, ENTITY_GROUPS } from '@/lib/admin/entities';
import { createClient } from '@/lib/supabase/server';

export default async function AdminHome() {
  const supabase = await createClient();
  const keys = ENTITY_GROUPS.flatMap((group) => group.keys).filter((key) => !ENTITIES[key].readOnly);
  const counts = await Promise.all(
    keys.map(async (key) => {
      const { count, error } = await supabase.from(ENTITIES[key].table).select('id', { count: 'exact', head: true });
      return { key, count: error ? null : (count ?? 0) };
    }),
  );

  return (
    <>
      <PageHeader title="Administration" subtitle="Ajoutez et modifiez le contenu du site sans toucher au code." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map(({ key, count }) => (
          <li key={key}>
            <Link href={`/admin/${key}`}>
              <Card className="p-5 transition hover:border-[var(--accent)]">
                <p className="text-3xl font-semibold tabular-nums">{count ?? '—'}</p>
                <p className="mt-1 font-medium">{ENTITIES[key].plural}</p>
                <p className="mt-1 text-xs text-zinc-400">{ENTITIES[key].description}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-zinc-500">
        Les suppressions sont réservées aux administrateurs. Les contenus saisis ici sont marqués « saisie manuelle » tant que vous ne choisissez pas une autre provenance. Un « — » signifie que la liste n’est pas accessible avec votre rôle.
      </p>
    </>
  );
}
