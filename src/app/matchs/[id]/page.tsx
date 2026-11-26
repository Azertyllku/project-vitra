import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AiReportPanel } from '@/components/ai-report-panel';
import { LiveRefresh } from '@/components/live-refresh';
import { Badge, Card, EmptyState, Logo, SectionTitle, StatusBadge } from '@/components/ui';
import { fetchReports } from '@/lib/data/ai';
import { getEntitlements } from '@/lib/data/entitlements';
import { fetchMatch, fetchMatchStats } from '@/lib/data/matches';
import { formatDateTime } from '@/lib/format';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const match = await fetchMatch(id);
  if (!match) return { title: 'Match introuvable' };
  const names = match.teams.map((t) => t.team?.name ?? t.placeholder_label ?? 'À déterminer').join(' vs ');
  return { title: names || 'Match' };
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  const match = await fetchMatch(id);
  if (!match) notFound();

  const ent = await getEntitlements();
  const [{ rows, definitions }, reports] = await Promise.all([
    fetchMatchStats(match.id, match.game_id),
    ent.userId ? fetchReports('match_id', match.id, 'match') : Promise.resolve([]),
  ]);
  const showScore = match.status === 'live' || match.status === 'finished';

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {(match.status === 'live' || match.status === 'scheduled') && <LiveRefresh matchId={match.id} />}

      <p className="mb-4 text-sm text-zinc-400">
        {match.game && (
          <Link href={`/jeux/${match.game.slug}`} className="hover:text-white">
            {match.game.name}
          </Link>
        )}
        {match.tournament && (
          <>
            {' · '}
            <Link href={`/tournois/${match.tournament.slug}`} className="hover:text-white">
              {match.tournament.name}
            </Link>
          </>
        )}
        {match.round_label ? ` · ${match.round_label}` : ''}
      </p>

      <Card className="p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <StatusBadge status={match.status} />
          {match.data_source === 'demo' && <Badge tone="amber">Données de démonstration</Badge>}
          <span className="text-sm text-zinc-400">
            {formatDateTime(match.scheduled_at)}
            {match.best_of ? ` · BO${match.best_of}` : ''}
          </span>
        </div>

        <ul className="space-y-4">
          {match.teams.map((entry) => {
            const name = entry.team?.name ?? entry.placeholder_label ?? 'À déterminer';
            const inner = (
              <>
                <Logo src={entry.team?.logo_url ?? null} name={name} size={48} />
                <span className={`flex-1 text-xl ${entry.is_winner ? 'font-bold' : ''}`}>{name}</span>
              </>
            );
            return (
              <li key={entry.slot} className="flex items-center gap-4">
                {entry.team ? (
                  <Link href={`/equipes/${entry.team.slug}`} className="flex flex-1 items-center gap-4 hover:text-[var(--accent-blue)]">
                    {inner}
                  </Link>
                ) : (
                  <span className="flex flex-1 items-center gap-4">{inner}</span>
                )}
                {showScore && <span className="font-mono text-4xl tabular-nums">{entry.score ?? '—'}</span>}
              </li>
            );
          })}
          {match.teams.length === 0 && <li className="text-zinc-500">Participants à confirmer.</li>}
        </ul>
      </Card>

      <SectionTitle>Statistiques du match</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState>Les statistiques détaillées ne sont pas disponibles pour ce match.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-zinc-400">
                <th className="px-4 py-3">Joueur / équipe</th>
                {definitions.map((d) => (
                  <th key={d.key} className="px-4 py-3 text-right">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">{row.player?.nickname ?? row.team?.name ?? '—'}</td>
                  {definitions.map((d) => (
                    <td key={d.key} className="px-4 py-3 text-right tabular-nums">
                      {row.stats[d.key] ?? '—'}
                      {row.stats[d.key] != null && d.unit ? ` ${d.unit}` : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <SectionTitle>Résumé IA</SectionTitle>
      <Card className="p-5">
        <AiReportPanel kind="match" targetId={match.id} initial={reports} loggedIn={Boolean(ent.userId)} />
      </Card>
    </main>
  );
}
