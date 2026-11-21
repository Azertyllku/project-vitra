import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LiveRefresh } from '@/components/live-refresh';
import { MatchGrid } from '@/components/match-card';
import { Badge, Card, EmptyState, ErrorState, Logo, SectionTitle, StatusBadge } from '@/components/ui';
import { fetchGameBySlug, fetchStandings } from '@/lib/data/catalog';
import { fetchMatches } from '@/lib/data/matches';
import type { TournamentRow } from '@/lib/data/types';
import { TOURNAMENT_STATUS_LABEL, formatDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = await fetchGameBySlug(slug);
  return { title: game?.name ?? 'Jeu introuvable', description: game?.description ?? undefined };
}

export default async function JeuPage({ params }: Props) {
  const { slug } = await params;
  const game = await fetchGameBySlug(slug);
  if (!game) notFound();

  const supabase = await createClient();
  const [live, upcoming, results, standings, tournaments] = await Promise.all([
    fetchMatches({ status: 'live', gameSlug: slug, limit: 6 }),
    fetchMatches({ status: 'scheduled', gameSlug: slug, limit: 6, ascending: true }),
    fetchMatches({ status: 'finished', gameSlug: slug, limit: 6 }),
    fetchStandings(game.id, 10),
    supabase
      .from('tournaments')
      .select('id, slug, name, status, starts_at, ends_at')
      .eq('game_id', game.id)
      .in('status', ['ongoing', 'upcoming'])
      .order('starts_at', { ascending: true })
      .limit(6)
      .returns<Pick<TournamentRow, 'id' | 'slug' | 'name' | 'status' | 'starts_at' | 'ends_at'>[]>(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <LiveRefresh />
      <header className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="h-2" style={{ background: game.accent_color ?? 'var(--accent)' }} />
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold">{game.name}</h1>
          {game.genre && <p className="mt-1 text-zinc-400">{game.genre}</p>}
          {game.description && <p className="mt-3 max-w-2xl text-zinc-300">{game.description}</p>}
        </div>
      </header>

      <SectionTitle href={`/matchs?statut=live&jeu=${slug}`}>En direct</SectionTitle>
      {live.failed ? <ErrorState /> : live.matches.length === 0 ? <EmptyState>Aucun match en direct.</EmptyState> : <MatchGrid matches={live.matches} />}

      <SectionTitle href={`/matchs?statut=a-venir&jeu=${slug}`}>Prochains matchs</SectionTitle>
      {upcoming.failed ? <ErrorState /> : upcoming.matches.length === 0 ? <EmptyState>Aucun match programmé.</EmptyState> : <MatchGrid matches={upcoming.matches} />}

      <SectionTitle href={`/matchs?statut=termines&jeu=${slug}`}>Derniers résultats</SectionTitle>
      {results.failed ? <ErrorState /> : results.matches.length === 0 ? <EmptyState>Aucun résultat enregistré.</EmptyState> : <MatchGrid matches={results.matches} />}

      <SectionTitle href={`/tournois?jeu=${slug}`}>Tournois</SectionTitle>
      {tournaments.error ? (
        <ErrorState />
      ) : !tournaments.data || tournaments.data.length === 0 ? (
        <EmptyState>Aucun tournoi à venir ou en cours.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {tournaments.data.map((t) => (
            <li key={t.id}>
              <Link href={`/tournois/${t.slug}`}>
                <Card className="flex items-center justify-between gap-3 p-4 transition hover:border-[var(--accent)]">
                  <span>
                    <span className="block font-medium">{t.name}</span>
                    <span className="text-xs text-zinc-400">
                      {formatDate(t.starts_at)} → {formatDate(t.ends_at)}
                    </span>
                  </span>
                  <Badge tone={t.status === 'ongoing' ? 'violet' : 'neutral'}>{TOURNAMENT_STATUS_LABEL[t.status]}</Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle href={`/classements?jeu=${slug}`}>Classement des équipes</SectionTitle>
      {standings.failed ? (
        <ErrorState />
      ) : standings.rows.length === 0 ? (
        <EmptyState>Pas encore assez de matchs terminés pour établir un classement.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {standings.rows.map((row, index) => (
                <tr key={row.team.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="w-10 px-4 py-3 text-zinc-500">{index + 1}</td>
                  <td className="py-3">
                    <Link href={`/equipes/${row.team.slug}`} className="flex items-center gap-3 hover:text-[var(--accent-blue)]">
                      <Logo src={row.team.logo_url} name={row.team.name} size={28} />
                      {row.team.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.wins}V - {row.losses}D
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{row.winRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="sr-only">
        <StatusBadge status="scheduled" />
      </p>
    </main>
  );
}
