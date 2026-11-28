import type { Metadata } from 'next';
import { AdminImportForm } from '@/components/admin-import-form';
import { Card, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Import CSV' };

export default function AdminImportPage() {
  return (
    <>
      <PageHeader title="Import CSV" subtitle="Chargez des équipes, joueurs, effectifs, tournois, matchs et rediffusions en masse, avec simulation avant écriture." />
      <Card className="p-6">
        <AdminImportForm />
      </Card>
      <div className="mt-6 space-y-2 text-sm text-zinc-400">
        <p><strong className="text-zinc-300">Ordre conseillé :</strong> équipes, joueurs, effectifs, tournois, matchs, rediffusions (chaque étape référence les précédentes par leur slug).</p>
        <p>Réimporter un fichier met à jour les équipes, joueurs, tournois, matchs et rediffusions déjà importés (par slug ou par ref) au lieu de les dupliquer ; les champs vides du fichier remplacent les valeurs existantes.</p>
        <p>Les rediffusions sont enregistrées avec des droits « pending » par défaut : elles ne deviennent visibles qu’une fois autorisées avec un titulaire des droits.</p>
        <p>Les matchs « en direct » ne s’importent pas (ils déclenchent des notifications) : saisissez-les depuis la section Matchs.</p>
      </div>
    </>
  );
}
