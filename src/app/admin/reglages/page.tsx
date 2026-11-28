import type { Metadata } from 'next';
import { saveSetting } from '@/app/admin/user-actions';
import { AdminForm } from '@/components/admin-form';
import { Card, EmptyState, ErrorState, PageHeader } from '@/components/ui';
import type { Field } from '@/lib/admin/entities';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Réglages' };

const FIELDS: Field[] = [
  { name: 'value', label: 'Valeur (JSON)', type: 'textarea', required: true, help: 'Exemples : true, 42, "texte" ou {"clé": 1}.' },
  { name: 'is_public', label: 'Visible publiquement', type: 'checkbox' },
];

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('platform_settings').select('key, value, is_public').order('key').returns<{ key: string; value: unknown; is_public: boolean }[]>();
  const settings = data ?? [];

  return (
    <>
      <PageHeader title="Réglages de la plateforme" subtitle="Paramètres globaux du site. Modification réservée aux administrateurs." />
      {error ? (
        <ErrorState />
      ) : settings.length === 0 ? (
        <EmptyState>Aucun réglage enregistré.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {settings.map((setting) => (
            <li key={setting.key}>
              <Card className="p-5">
                <p className="mb-3 font-mono text-sm text-[var(--accent-blue)]">{setting.key}</p>
                <AdminForm
                  action={saveSetting.bind(null, setting.key)}
                  fields={FIELDS}
                  values={{ value: JSON.stringify(setting.value, null, 2), is_public: setting.is_public }}
                  options={{}}
                  submitLabel="Enregistrer"
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
