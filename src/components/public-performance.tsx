import { SourceBadge } from '@/components/source-badge';
import { Card, SectionTitle } from '@/components/ui';
import { formatPlaytime, winRate, type Performance } from '@/lib/data/performance';
import { createClient } from '@/lib/supabase/server';

/**
 * Statistiques publiques d'un membre : uniquement les comptes vérifiés ET rendus publics par leur propriétaire
 * (la RLS garantit ce filtre). Chaque bloc indique la provenance des données.
 */
export async function PublicPerformance({ profileId }: { profileId: string }) {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from('player_game_accounts')
    .select('id, display_name, provider, game:games(name)')
    .eq('profile_id', profileId)
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .returns<{ id: string; display_name: string | null; provider: string; game: { name: string } | null }[]>();
  if (!accounts || accounts.length === 0) return null;

  const blocks = await Promise.all(
    accounts.map(async (account) => {
      const { data } = await supabase.rpc('account_performance', { _account: account.id, _since: null });
      return { account, perf: (data ?? null) as Performance | null };
    }),
  );

  return (
    <>
      <SectionTitle>Statistiques</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {blocks.map(({ account, perf }) => (
          <Card key={account.id} className="p-5">
            <p className="font-semibold">{account.game?.name}{account.display_name ? ` · ${account.display_name}` : ''}</p>
            {!perf || perf.played === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Aucune partie enregistrée.</p>
            ) : (
              <>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-zinc-400">Parties</dt><dd className="text-lg tabular-nums">{perf.played}</dd></div>
                  <div><dt className="text-zinc-400">Victoires</dt><dd className="text-lg tabular-nums">{perf.wins}</dd></div>
                  <div><dt className="text-zinc-400">% victoires</dt><dd className="text-lg tabular-nums">{winRate(perf) ?? '—'}{winRate(perf) != null ? ' %' : ''}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-zinc-500">Temps de jeu enregistré : {formatPlaytime(perf.seconds)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(perf.by_source).map(([source, count]) => (
                    <span key={source} className="flex items-center gap-1 text-xs text-zinc-400"><SourceBadge source={source} /> {count}</span>
                  ))}
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
