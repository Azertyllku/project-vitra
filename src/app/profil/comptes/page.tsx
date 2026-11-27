import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountVisibilityToggle } from '@/components/account-visibility';
import { ConnectPanel } from '@/components/connect-panel';
import { VerificationBadge } from '@/components/source-badge';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { ACCOUNT_PROVIDER_LABEL, PROVIDERS, isConfigured } from '@/lib/connect/providers';
import { fetchGames } from '@/lib/data/catalog';
import { one } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Comptes de jeu connectés' };

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: 'Compte connecté et vérifié.' },
  non_configure: { ok: false, text: 'Cette connexion n’est pas encore activée (clés du fournisseur manquantes).' },
  etat: { ok: false, text: 'La connexion a expiré ou a été interrompue, réessayez.' },
  refuse: { ok: false, text: 'Connexion annulée ou refusée.' },
  echec: { ok: false, text: 'La vérification du compte a échoué, réessayez plus tard.' },
  deja: { ok: false, text: 'Ce compte de jeu est déjà vérifié par un autre membre.' },
  jeu: { ok: false, text: 'Ce fournisseur ne prend pas en charge ce jeu.' },
};

interface AccountRow {
  id: string;
  provider: string;
  display_name: string | null;
  verification_status: string;
  is_public: boolean;
  game: { name: string } | null;
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ComptesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/connexion?next=/profil/comptes');

  const [{ games }, accountsRes] = await Promise.all([
    fetchGames(),
    supabase
      .from('player_game_accounts')
      .select('id, provider, display_name, verification_status, is_public, game:games(name)')
      .eq('profile_id', user.id)
      .order('created_at')
      .returns<AccountRow[]>(),
  ]);
  const accounts = accountsRes.data ?? [];
  const notice = NOTICES[one(sp.connexion) ?? ''];

  const providers = Object.values(PROVIDERS)
    .map((def) => ({
      id: def.id,
      label: def.label,
      configured: isConfigured(def),
      games: games.filter((game) => def.games.includes(game.slug)).map((game) => ({ slug: game.slug, name: game.name })),
    }))
    .filter((provider) => provider.games.length > 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Comptes de jeu connectés" subtitle="Prouvez que vous êtes bien le propriétaire d’un compte pour suivre ses performances.">
        <Link href="/profil/performances" className="text-sm text-[var(--accent-blue)] hover:underline">← Mes performances</Link>
      </PageHeader>

      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className={`mb-6 rounded-lg border px-3 py-2 text-sm ${notice.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
          {notice.text}
        </p>
      )}

      <p className="mb-4 text-sm text-zinc-400">
        La connexion se fait sur le site du fournisseur : ESPORT HUB ne voit jamais votre mot de passe et ne reçoit que l’identifiant public de votre compte.
      </p>
      <ConnectPanel providers={providers} />

      <SectionTitle>Mes comptes</SectionTitle>
      {accounts.length === 0 ? (
        <EmptyState>Aucun compte pour le moment.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {accounts.map((account) => (
            <li key={account.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{account.game?.name ?? 'Jeu'} · {account.display_name ?? '—'}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    {ACCOUNT_PROVIDER_LABEL[account.provider] ?? account.provider}
                    <VerificationBadge status={account.verification_status} />
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {account.verification_status === 'verified' ? (
                    <AccountVisibilityToggle accountId={account.id} isPublic={account.is_public} />
                  ) : (
                    <span className="text-xs text-zinc-500">Visible uniquement par vous</span>
                  )}
                  <Link href={`/profil/performances?compte=${account.id}`} className="text-sm text-[var(--accent-blue)] hover:underline">Performances</Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
