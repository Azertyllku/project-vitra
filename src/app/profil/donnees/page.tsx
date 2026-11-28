import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DeleteAccountForm } from '@/components/delete-account-form';
import { Card, PageHeader, SectionTitle } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mes données', robots: { index: false } };

export default async function DonneesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/connexion?next=/profil/donnees');
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle<{ username: string }>();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <PageHeader title="Mes données" subtitle="Téléchargez ou supprimez les données de votre compte.">
        <Link href="/profil" className="text-sm text-[var(--accent-blue)] hover:underline">← Mon profil</Link>
      </PageHeader>

      <SectionTitle>Télécharger mes données</SectionTitle>
      <Card className="space-y-3 p-5">
        <p className="text-sm text-zinc-300">
          Un fichier JSON regroupe votre profil, vos préférences, vos comptes de jeu, votre historique de parties, vos publications, commentaires, messages, abonnements, favoris, notifications et rapports (5 000 lignes maximum par tableau).
        </p>
        <a href="/api/account/export" className="inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:brightness-110">Télécharger mes données</a>
      </Card>

      <SectionTitle>Supprimer mon compte</SectionTitle>
      <Card className="space-y-4 p-5">
        <p className="text-sm text-zinc-300">
          La suppression est <strong>définitive</strong> : votre profil, vos comptes de jeu, votre historique, vos publications, commentaires et messages sont effacés. Téléchargez d’abord vos données si vous voulez en garder une copie.
        </p>
        <DeleteAccountForm username={profile?.username ?? ''} />
      </Card>
    </main>
  );
}
