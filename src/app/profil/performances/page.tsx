import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProgressCharts, RankChart } from '@/components/performance-charts';
import {
  AddAccountForm,
  AddMatchForm,
  CreatePlayerProfileForm,
  DeleteAccountButton,
  DeleteMatchButton,
  SyncButton,
} from '@/components/performance-forms';
import { SourceBadge, VerificationBadge } from '@/components/source-badge';
import { Badge, Card, EmptyState, ErrorState, FilterTabs, PageHeader, Pager, SectionTitle } from '@/components/ui';
import { fetchGames } from '@/lib/data/catalog';
import { PERIODS, fetchPerformance, findPeriod, formatPlaytime, sinceDays, winRate, type Dim } from '@/lib/data/performance';
import { buildInsights } from '@/lib/insights';
import { formatDateTime } from '@/lib/format';
import { one, pageNumber } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';
import { formatDuration } from '@/lib/video-utils';

export const metadata: Metadata = { title: 'Mes performances' };

const PAGE_SIZE = 20;
const RESULT_LABEL: Record<string, string> = { win: 'Victoire', loss: 'Défaite', draw: 'Égalité', unknown: 'Inconnu' };
const CONNECTOR_PROVIDERS = new Set(['opendota']);

interface AccountRow {
  id: string;
  provider: string;
  display_name: string | null;
  region: string | null;
  verification_status: string;
  is_public: boolean;
  last_synced_at: string | null;
  game: { id: string; slug: string; name: string } | null;
}

interface HistoryRow {
  id: string;
  played_at: string;
  result: string;
  map_name: string | null;
  character_name: string | null;
  role_name: string | null;
  duration_seconds: number | null;
  stats: Record<string, number | string | null>;
  data_source: string;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </Card>
  );
}

function DimTable({ title, rows }: { title: string; rows: Dim[] }) {
  if (rows.length === 0) return null;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="px-4 pt-4 text-left font-semibold">{title}</caption>
        <thead><tr className="text-left text-zinc-400"><th className="px-4 py-2">Nom</th><th className="px-4 py-2 text-right">Parties</th><th className="px-4 py-2 text-right">% victoires</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-[var(--border)]">
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2 text-right tabular-nums">{row.played}</td>
              <td className="px-4 py-2 text-right tabular-nums">{Math.round((row.wins / row.played) * 1000) / 10} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PerformancesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/connexion?next=/profil/performances');

  const [{ games }, accountsRes, playerRes, profileRes] = await Promise.all([
    fetchGames(),
    supabase
      .from('player_game_accounts')
      .select('id, provider, display_name, region, verification_status, is_public, last_synced_at, game:games(id, slug, name)')
      .eq('profile_id', user.id)
      .order('created_at')
      .returns<AccountRow[]>(),
    supabase.from('players').select('id, slug, nickname').eq('profile_id', user.id).maybeSingle<{ id: string; slug: string; nickname: string }>(),
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle<{ username: string }>(),
  ]);

  const accounts = accountsRes.data ?? [];
  const account = accounts.find((a) => a.id === one(sp.compte)) ?? accounts[0];
  const period = findPeriod(one(sp.periode));
  const page = pageNumber(sp.page);
  const player = playerRes.data;
  const username = profileRes.data?.username ?? '';

  let body: React.ReactNode = null;
  if (account?.game) {
    const since = sinceDays(period.days);
    const [perf, perfDouble, defsRes, ranksRes, historyRes] = await Promise.all([
      fetchPerformance(account.id, since),
      period.days ? fetchPerformance(account.id, sinceDays(period.days, 2)) : Promise.resolve(null),
      supabase.from('game_statistics_definitions').select('key, label, unit, higher_is_better').eq('game_id', account.game.id).eq('scope', 'player_match').order('display_order').returns<{ key: string; label: string; unit: string | null; higher_is_better: boolean | null }[]>(),
      (since
        ? supabase.from('player_rank_history').select('recorded_at, rating, rank_label').eq('account_id', account.id).gte('recorded_at', since)
        : supabase.from('player_rank_history').select('recorded_at, rating, rank_label').eq('account_id', account.id)
      ).order('recorded_at').limit(500).returns<{ recorded_at: string; rating: number | null; rank_label: string | null }[]>(),
      supabase.from('player_match_history').select('id, played_at, result, map_name, character_name, role_name, duration_seconds, stats, data_source').eq('account_id', account.id).order('played_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE).returns<HistoryRow[]>(),
    ]);

    const definitions = defsRes.data ?? [];
    const history = historyRes.data ?? [];
    const ranks = (ranksRes.data ?? []).filter((r) => r.rating != null);
    const previous = perf && perfDouble ? { played: perfDouble.played - perf.played, wins: perfDouble.wins - perf.wins, losses: perfDouble.losses - perf.losses, draws: perfDouble.draws - perf.draws } : null;
    const insights = perf ? buildInsights(perf, previous) : [];
    const rate = perf ? winRate(perf) : null;
    const firstRank = ranks[0];
    const lastRank = ranks[ranks.length - 1];
    const rankDelta = firstRank && lastRank && firstRank.rating != null && lastRank.rating != null ? lastRank.rating - firstRank.rating : null;

    const params: Record<string, string> = { compte: account.id, periode: period.key };
    const link = (override: Record<string, string>) => `/profil/performances?${new URLSearchParams({ ...params, ...override }).toString()}`;

    body = (
      <>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <VerificationBadge status={account.verification_status} />
          {account.verification_status !== 'verified' && (
            <span className="text-xs text-zinc-500">Ce compte n’est visible que par vous : seuls les comptes vérifiés peuvent être rendus publics.</span>
          )}
          {CONNECTOR_PROVIDERS.has(account.provider) && <SyncButton accountId={account.id} />}
          {account.last_synced_at && <span className="text-xs text-zinc-500">Dernière synchronisation : {formatDateTime(account.last_synced_at)}</span>}
        </div>

        <FilterTabs items={PERIODS.map((p) => ({ label: p.label, href: link({ periode: p.key }), active: p.key === period.key }))} />

        {!perf ? (
          <div className="mt-6"><ErrorState /></div>
        ) : perf.played === 0 ? (
          <div className="mt-6"><EmptyState>Aucune partie enregistrée sur cette période. Saisissez une partie ci-dessous{CONNECTOR_PROVIDERS.has(account.provider) ? ' ou lancez une synchronisation' : ''}.</EmptyState></div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Parties" value={String(perf.played)} />
              <Kpi label="Victoires / défaites" value={`${perf.wins} / ${perf.losses}`} />
              <Kpi label="Taux de victoire" value={rate != null ? `${rate} %` : '—'} />
              <Kpi label="Série en cours" value={perf.streak.kind ? `${perf.streak.length} ${perf.streak.kind === 'win' ? 'V' : 'D'}` : '—'} />
              <Kpi label="Temps de jeu" value={formatPlaytime(perf.seconds)} hint="Parties dont la durée est connue" />
              <Kpi label="Rang actuel" value={lastRank ? lastRank.rank_label ?? String(lastRank.rating) : 'Non disponible'} hint={rankDelta != null ? `Évolution sur la période : ${rankDelta > 0 ? '+' : ''}${rankDelta}` : undefined} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              Provenance des données :
              {Object.entries(perf.by_source).map(([source, count]) => <span key={source} className="flex items-center gap-1"><SourceBadge source={source} /> {count} partie{count > 1 ? 's' : ''}</span>)}
            </div>

            <SectionTitle>Observations</SectionTitle>
            <Card className="p-5">
              <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-300">{insights.map((text) => <li key={text}>{text}</li>)}</ul>
              <p className="mt-3 text-xs text-zinc-500">Calculées uniquement à partir des parties enregistrées ci-dessous, avec un minimum de 5 parties.</p>
            </Card>

            <SectionTitle>Progression</SectionTitle>
            <Card className="p-5"><ProgressCharts days={perf.by_day} /></Card>

            {ranks.length > 1 && (
              <>
                <SectionTitle>Évolution du rang</SectionTitle>
                <Card className="p-5"><RankChart points={ranks.map((r) => ({ date: r.recorded_at.slice(0, 10), rating: r.rating as number }))} /></Card>
              </>
            )}

            <SectionTitle>Statistiques avancées</SectionTitle>
            {definitions.filter((d) => perf.stat_averages[d.key]).length === 0 ? (
              <EmptyState>Aucune statistique détaillée enregistrée pour cette période.</EmptyState>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-zinc-400"><th className="px-4 py-3">Statistique</th><th className="px-4 py-3 text-right">Moyenne par partie</th><th className="px-4 py-3 text-right">Parties renseignées</th></tr></thead>
                  <tbody>
                    {definitions.filter((d) => perf.stat_averages[d.key]).map((d) => (
                      <tr key={d.key} className="border-t border-[var(--border)]">
                        <td className="px-4 py-2">{d.label}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{perf.stat_averages[d.key].avg}{d.unit ? ` ${d.unit}` : ''}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-zinc-400">{perf.stat_averages[d.key].n} / {perf.played}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <DimTable title="Par carte" rows={perf.by_map} />
              <DimTable title="Par personnage" rows={perf.by_character} />
              <DimTable title="Par rôle" rows={perf.by_role} />
            </div>
          </>
        )}

        <SectionTitle>Saisir une partie</SectionTitle>
        <Card className="p-5"><AddMatchForm accountId={account.id} gameId={account.game.id} definitions={definitions} /></Card>

        <SectionTitle>Historique des parties</SectionTitle>
        {historyRes.error ? (
          <ErrorState />
        ) : history.length === 0 ? (
          <EmptyState>Aucune partie enregistrée.</EmptyState>
        ) : (
          <>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-zinc-400"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Résultat</th><th className="px-4 py-3">Détails</th><th className="px-4 py-3">Statistiques</th><th className="px-4 py-3">Source</th><th /></tr></thead>
                <tbody>
                  {history.slice(0, PAGE_SIZE).map((row) => (
                    <tr key={row.id} className="border-t border-[var(--border)] align-top">
                      <td className="whitespace-nowrap px-4 py-2">{formatDateTime(row.played_at)}</td>
                      <td className="px-4 py-2"><Badge tone={row.result === 'win' ? 'violet' : 'neutral'}>{RESULT_LABEL[row.result] ?? row.result}</Badge></td>
                      <td className="px-4 py-2 text-zinc-300">{[row.map_name, row.character_name, row.role_name, formatDuration(row.duration_seconds)].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-4 py-2 text-zinc-300">{definitions.filter((d) => row.stats?.[d.key] != null).slice(0, 4).map((d) => `${d.label} ${row.stats[d.key]}`).join(' · ') || '—'}</td>
                      <td className="px-4 py-2"><SourceBadge source={row.data_source} /></td>
                      <td className="px-4 py-2">{row.data_source === 'manual' && <DeleteMatchButton matchId={row.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Pager basePath="/profil/performances" params={params} page={page} hasNext={history.length > PAGE_SIZE} />
          </>
        )}

        <div className="mt-10 flex justify-end"><DeleteAccountButton accountId={account.id} name={account.display_name ?? account.game.name} /></div>
      </>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader title="Mes performances" subtitle="Suivez vos parties et votre progression, jeu par jeu.">
        <span className="flex gap-4 text-sm">
          <Link href="/profil/comparateur" className="text-[var(--accent-blue)] hover:underline">Comparateur</Link>
          <Link href="/profil" className="text-[var(--accent-blue)] hover:underline">← Mon profil</Link>
        </span>
      </PageHeader>

      {accountsRes.error ? <ErrorState /> : accounts.length > 0 && (
        <FilterTabs items={accounts.map((a) => ({ label: `${a.game?.name ?? 'Jeu'} · ${a.display_name ?? a.provider}`, href: `/profil/performances?compte=${a.id}`, active: a.id === account?.id }))} />
      )}

      <div className="mt-8">
        {body ?? <EmptyState>Vous n’avez pas encore de compte de jeu. Ajoutez-en un pour commencer à suivre vos performances.</EmptyState>}
      </div>

      <SectionTitle>Ajouter un compte de jeu</SectionTitle>
      <Card className="p-5">
        <AddAccountForm games={games.map((g) => ({ id: g.id, slug: g.slug, name: g.name }))} playerId={player?.id ?? null} />
      </Card>

      <SectionTitle>Profil joueur public</SectionTitle>
      <Card className="p-5">
        {player ? (
          <p className="text-sm">Votre profil joueur est en ligne : <Link href={`/joueurs/${player.slug}`} className="text-[var(--accent-blue)] hover:underline">{player.nickname}</Link>. Vos statistiques n’y apparaissent que pour les comptes vérifiés que vous rendez publics.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-400">Créez votre page joueur publique (profil amateur).</p>
            <CreatePlayerProfileForm username={username} />
          </>
        )}
      </Card>
    </main>
  );
}
