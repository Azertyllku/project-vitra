import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MatchGrid } from '@/components/match-card';
import { Badge, Card, EmptyState, Logo, SectionTitle } from '@/components/ui';
import { fetchMatches } from '@/lib/data/matches';
import type { TeamLite, TournamentRow } from '@/lib/data/types';
import { FORMAT_LABEL, TOURNAMENT_STATUS_LABEL, formatDate, formatMoney } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ slug: string }> };

const COLUMNS =
  'id, slug, name, organizer, format, status, region, starts_at, ends_at, prize_pool, currency, logo_url, description, data_source, game:games(slug, name)';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('tournaments').select('name, description').eq('slug', slug).maybeSingle<{ name: string; description: string | null }>();
  return { title: data?.name ?? 'Tournoi introuvable', description: data?.description ?? undefined };
}

export default async function TournoiPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tournament } = await supabase.from('tournaments').select(COLUMNS).eq('slug', slug).maybeSingle<TournamentRow>();
  if (!tournament) notFound();

  const [participants, rankings, matches] = await Promise.all([
    supabase
      .from('tournament_participants')
      .select('seed, placement, prize, team:teams(id, slug, name, tag, logo_url, country_code)')
      .eq('tournament_id', tournament.id)
      .order('seed', { nullsFirst: false })
      .returns<{ seed: number | null; placement: number | null; prize: number | null; team: TeamLite | null }[]>(),
    supabase
      .from('tournament_rankings')
      .select('rank, points, wins, losses, team:teams(id, slug, name, tag, logo_url, country_code)')
      .eq('tournament_id', tournament.id)
      .order('rank')
      .limit(50)
      .returns<{ rank: number; points: number; wins: number; losses: number; team: TeamLite | null }[]>(),
    fetchMatches({ tournamentId: tournament.id, limit: 30, ascending: true }),
  ]);

  const prize = formatMoney(tournament.prize_pool, tournament.currency);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={tournament.status === 'ongoing' ? 'violet' : 'neutral'}>{TOURNAMENT_STATUS_LABEL[tournament.status]}</Badge>
          {tournament.data_source === 'demo' && <Badge tone="amber">Données de démonstration</Badge>}
        </div>
        <h1 className="text-3xl font-bold">{tournament.name}</h1>
        <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {tournament.game && (
            <div className="flex gap-2">
              <dt className="text-zinc-400">Jeu</dt>
              <dd>
                <Link href={`/jeux/${tournament.game.slug}`} className="hover:text-[var(--accent-blue)]">
                  {tournament.game.name}
                </Link>
              </dd>
            </div>
          )}
          <div className="flex gap-2"><dt className="text-zinc-400">Format</dt><dd>{FORMAT_LABEL[tournament.format] ?? tournament.format}</dd></div>
          <div className="flex gap-2"><dt className="text-zinc-400">Dates</dt><dd>{formatDate(tournament.starts_at)} → {formatDate(tournament.ends_at)}</dd></div>
          {prize && <div className="flex gap-2"><dt className="text-zinc-400">Cashprize</dt><dd>{prize}</dd></div>}
          {tournament.organizer && <div className="flex gap-2"><dt className="text-zinc-400">Organisateur</dt><dd>{tournament.organizer}</dd></div>}
          {tournament.region && <div className="flex gap-2"><dt className="text-zinc-400">Région</dt><dd>{tournament.region}</dd></div>}
        </dl>
        {tournament.description && <p className="mt-4 text-zinc-300">{tournament.description}</p>}
      </header>

      <SectionTitle>Matchs</SectionTitle>
      {matches.matches.length === 0 ? <EmptyState>Aucun match enregistré pour ce tournoi.</EmptyState> : <MatchGrid matches={matches.matches} />}

      {rankings.data && rankings.data.length > 0 && (
        <>
          <SectionTitle>Classement</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {rankings.data.map((row) => (
                  <tr key={`${row.rank}-${row.team?.id}`} className="border-b border-[var(--border)] last:border-0">
                    <td className="w-10 px-4 py-3 text-zinc-500">{row.rank}</td>
                    <td className="py-3">{row.team ? <Link href={`/equipes/${row.team.slug}`} className="hover:text-[var(--accent-blue)]">{row.team.name}</Link> : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.wins}V - {row.losses}D</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{row.points} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <SectionTitle>Participants</SectionTitle>
      {!participants.data || participants.data.length === 0 ? (
        <EmptyState>Participants à confirmer.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {participants.data.map((p) =>
            p.team ? (
              <li key={p.team.id}>
                <Link href={`/equipes/${p.team.slug}`}>
                  <Card className="flex items-center gap-3 p-4 transition hover:border-[var(--accent)]">
                    <Logo src={p.team.logo_url} name={p.team.name} size={36} />
                    <span className="flex-1 truncate">{p.team.name}</span>
                    {p.seed != null && <span className="text-xs text-zinc-500">#{p.seed}</span>}
                  </Card>
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </main>
  );
}
