import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CompareChart } from '@/components/performance-charts';
import { Card, EmptyState, ErrorState, FilterTabs, PageHeader, SectionTitle } from '@/components/ui';
import { PERIODS, fetchPerformance, findPeriod, formatPlaytime, sinceDays, winRate, type Performance } from '@/lib/data/performance';
import { one } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Comparateur' };

interface Acc {
  id: string;
  display_name: string | null;
  provider: string;
  game: { id: string; slug: string; name: string } | null;
  profile_id: string;
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Row({ label, a, b, better }: { label: string; a: string; b: string; better?: 'a' | 'b' | null }) {
  const cls = (side: 'a' | 'b') => `px-4 py-2 text-right tabular-nums ${better === side ? 'font-semibold text-emerald-300' : ''}`;
  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-4 py-2 text-zinc-400">{label}</td>
      <td className={cls('a')}>{a}</td>
      <td className={cls('b')}>{b}</td>
    </tr>
  );
}

function pick(a: number | null, b: number | null, higherIsBetter = true): 'a' | 'b' | null {
  if (a == null || b == null || a === b) return null;
  return (a > b) === higherIsBetter ? 'a' : 'b';
}

export default async function ComparateurPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/connexion?next=/profil/comparateur');

  const SELECT = 'id, display_name, provider, profile_id, game:games(id, slug, name)';
  const [{ data: mine }, { data: me }] = await Promise.all([
    supabase.from('player_game_accounts').select(SELECT).eq('profile_id', user.id).order('created_at').returns<Acc[]>(),
    supabase.from('profiles').select('esport_id, username').eq('id', user.id).maybeSingle<{ esport_id: string; username: string }>(),
  ]);
  const myAccounts = mine ?? [];
  const period = findPeriod(one(sp.periode));

  if (myAccounts.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader title="Comparateur" />
        <EmptyState>Ajoutez d’abord un compte de jeu dans <Link href="/profil/performances" className="text-[var(--accent-blue)] underline">Mes performances</Link> pour pouvoir comparer.</EmptyState>
      </main>
    );
  }

  const a = myAccounts.find((x) => x.id === one(sp.a)) ?? myAccounts[0];
  const gameId = a.game?.id ?? '';
  const eid = (one(sp.eid) ?? me?.esport_id ?? '').trim().toUpperCase().slice(0, 12);

  const { data: target } = eid
    ? await supabase.from('profiles').select('id, username, esport_id').eq('esport_id', eid).maybeSingle<{ id: string; username: string; esport_id: string }>()
    : { data: null };
  const { data: candidates } = target
    ? await supabase.from('player_game_accounts').select(SELECT).eq('profile_id', target.id).eq('game_id', gameId).returns<Acc[]>()
    : { data: null };
  const options = (candidates ?? []).filter((c) => c.id !== a.id);
  const b = options.find((x) => x.id === one(sp.b)) ?? options[0];

  const since = sinceDays(period.days);
  const [perfA, perfB, defsRes] = await Promise.all([
    fetchPerformance(a.id, since),
    b ? fetchPerformance(b.id, since) : Promise.resolve(null),
    supabase.from('game_statistics_definitions').select('key, label, unit, higher_is_better').eq('game_id', gameId).eq('scope', 'player_match').order('display_order').returns<{ key: string; label: string; unit: string | null; higher_is_better: boolean | null }[]>(),
  ]);

  const base = { a: a.id, eid, periode: period.key };
  const link = (override: Record<string, string>) => `/profil/comparateur?${new URLSearchParams({ ...base, ...override }).toString()}`;
  const labelA = `${me?.username ?? 'Moi'} · ${a.display_name ?? a.provider}`;
  const labelB = b ? `${target?.username ?? '?'} · ${b.display_name ?? b.provider}` : '';
  const rateA = perfA ? winRate(perfA) : null;
  const rateB = perfB ? winRate(perfB) : null;
  const defs = (defsRes.data ?? []).filter((d) => perfA?.stat_averages[d.key] || perfB?.stat_averages[d.key]);
  const fmt = (p: Performance | null, key: string, unit: string | null) => (p?.stat_averages[key] ? `${p.stat_averages[key].avg}${unit ? ` ${unit}` : ''}` : '—');

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Comparateur" subtitle="Comparez deux comptes d’un même jeu sur une même période.">
        <Link href="/profil/performances" className="text-sm text-[var(--accent-blue)] hover:underline">← Mes performances</Link>
      </PageHeader>

      <p className="mb-2 text-sm text-zinc-400">Votre compte</p>
      <FilterTabs items={myAccounts.map((x) => ({ label: `${x.game?.name} · ${x.display_name ?? x.provider}`, href: link({ a: x.id, b: '' }), active: x.id === a.id }))} />

      <form action="/profil/comparateur" className="mt-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="a" value={a.id} />
        <input type="hidden" name="periode" value={period.key} />
        <label className="text-sm">
          <span className="mb-1 block text-zinc-300">ESPORT ID du joueur à comparer</span>
          <input name="eid" defaultValue={eid} placeholder="EH-XXXXXXXX" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono uppercase outline-none focus:border-[var(--accent)]" />
        </label>
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium">Chercher</button>
      </form>
      <p className="mt-2 text-xs text-zinc-500">Par défaut, vous comparez vos propres comptes. Les comptes d’un autre membre ne sont visibles que s’ils sont vérifiés et rendus publics par leur propriétaire.</p>

      <div className="mt-6"><FilterTabs items={PERIODS.map((p) => ({ label: p.label, href: link({ periode: p.key, ...(b ? { b: b.id } : {}) }), active: p.key === period.key }))} /></div>

      <div className="mt-8">
        {eid && !target ? (
          <EmptyState>Aucun membre ne correspond à cet ESPORT ID.</EmptyState>
        ) : options.length === 0 ? (
          <EmptyState>Aucun autre compte comparable pour {a.game?.name} chez ce membre (ou ils ne sont pas publics).</EmptyState>
        ) : (
          <>
            {options.length > 1 && <div className="mb-6"><FilterTabs items={options.map((o) => ({ label: o.display_name ?? o.provider, href: link({ b: o.id }), active: o.id === b?.id }))} /></div>}
            {!perfA || !perfB ? (
              <ErrorState />
            ) : (
              <>
                <Card className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left"><th className="px-4 py-3 text-zinc-400">{a.game?.name} · {period.label}</th><th className="px-4 py-3 text-right">{labelA}</th><th className="px-4 py-3 text-right">{labelB}</th></tr></thead>
                    <tbody>
                      <Row label="Parties" a={String(perfA.played)} b={String(perfB.played)} />
                      <Row label="Victoires" a={String(perfA.wins)} b={String(perfB.wins)} better={pick(perfA.wins, perfB.wins)} />
                      <Row label="Taux de victoire" a={rateA != null ? `${rateA} %` : '—'} b={rateB != null ? `${rateB} %` : '—'} better={pick(rateA, rateB)} />
                      <Row label="Temps de jeu" a={formatPlaytime(perfA.seconds)} b={formatPlaytime(perfB.seconds)} />
                      {defs.map((d) => (
                        <Row key={d.key} label={d.label} a={fmt(perfA, d.key, d.unit)} b={fmt(perfB, d.key, d.unit)} better={d.higher_is_better == null ? null : pick(perfA.stat_averages[d.key]?.avg ?? null, perfB.stat_averages[d.key]?.avg ?? null, d.higher_is_better)} />
                      ))}
                    </tbody>
                  </table>
                </Card>
                <SectionTitle>Taux de victoire</SectionTitle>
                <Card className="p-5"><CompareChart labelA={labelA} labelB={labelB} rows={[{ name: 'Taux de victoire (%)', a: rateA, b: rateB }]} /></Card>
                <p className="mt-3 text-xs text-zinc-500">Les moyennes ne portent que sur les parties où la statistique est renseignée. Un « — » signifie donnée indisponible.</p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
