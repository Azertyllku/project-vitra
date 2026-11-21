import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MatchGrid } from '@/components/match-card';
import { Card, EmptyState, Logo, SectionTitle } from '@/components/ui';
import { fetchMatches } from '@/lib/data/matches';
import type { TeamLite } from '@/lib/data/types';
import { flag, formatDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ slug: string }> };
type TeamFull = TeamLite & { description: string | null; banner_url: string | null };

const ROLE_LABEL: Record<string, string> = { player: 'Joueur', substitute: 'Remplaçant', coach: 'Coach', analyst: 'Analyste', manager: 'Manager' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('teams').select('name, description').eq('slug', slug).maybeSingle<{ name: string; description: string | null }>();
  return { title: data?.name ?? 'Équipe introuvable', description: data?.description ?? undefined };
}

export default async function EquipePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: team } = await supabase
    .from('teams')
    .select('id, slug, name, tag, logo_url, banner_url, country_code, description')
    .eq('slug', slug)
    .maybeSingle<TeamFull>();
  if (!team) notFound();

  const [roster, history, matchRefs] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, role, joined_at, game:games(slug, name), player:players(slug, nickname, country_code)')
      .eq('team_id', team.id)
      .is('left_at', null)
      .order('role')
      .returns<{ id: string; role: string; joined_at: string; game: { slug: string; name: string } | null; player: { slug: string; nickname: string; country_code: string | null } | null }[]>(),
    supabase
      .from('team_history')
      .select('id, event_type, event_date, description')
      .eq('team_id', team.id)
      .order('event_date', { ascending: false })
      .limit(20)
      .returns<{ id: string; event_type: string; event_date: string; description: string | null }[]>(),
    supabase.from('match_teams').select('match_id').eq('team_id', team.id).limit(100).returns<{ match_id: string }[]>(),
  ]);

  const ids = (matchRefs.data ?? []).map((m) => m.match_id);
  const matches = ids.length > 0 ? await fetchMatches({ ids, limit: 6 }) : { matches: [], hasMore: false, failed: false };
  const members = (roster.data ?? []).filter((m) => m.player);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center gap-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <Logo src={team.logo_url} name={team.name} size={80} />
        <div>
          <h1 className="text-3xl font-bold">{team.name}</h1>
          <p className="text-zinc-400">{[team.tag, flag(team.country_code)].filter(Boolean).join(' · ')}</p>
          {team.description && <p className="mt-2 max-w-2xl text-zinc-300">{team.description}</p>}
        </div>
      </header>

      <SectionTitle>Effectif</SectionTitle>
      {members.length === 0 ? (
        <EmptyState>Effectif non renseigné.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/joueurs/${m.player!.slug}`}>
                <Card className="p-4 transition hover:border-[var(--accent)]">
                  <p className="font-medium">{flag(m.player!.country_code)} {m.player!.nickname}</p>
                  <p className="text-xs text-zinc-400">{ROLE_LABEL[m.role] ?? m.role}{m.game ? ` · ${m.game.name}` : ''}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Matchs</SectionTitle>
      {matches.matches.length === 0 ? <EmptyState>Aucun match enregistré pour cette équipe.</EmptyState> : <MatchGrid matches={matches.matches} />}

      {history.data && history.data.length > 0 && (
        <>
          <SectionTitle>Historique</SectionTitle>
          <Card>
            <ul className="divide-y divide-[var(--border)] text-sm">
              {history.data.map((event) => (
                <li key={event.id} className="flex gap-4 px-4 py-3">
                  <span className="w-28 shrink-0 text-zinc-400">{formatDate(event.event_date)}</span>
                  <span>{event.description ?? event.event_type}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </main>
  );
}
