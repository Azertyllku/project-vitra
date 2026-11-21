import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, EmptyState, Logo, SectionTitle } from '@/components/ui';
import type { PlayerLite } from '@/lib/data/types';
import { flag, formatDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ slug: string }> };
type PlayerFull = PlayerLite & { bio: string | null; socials: Record<string, string> | null };

const ROLE_LABEL: Record<string, string> = { player: 'Joueur', substitute: 'Remplaçant', coach: 'Coach', analyst: 'Analyste', manager: 'Manager' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('players').select('nickname, bio').eq('slug', slug).maybeSingle<{ nickname: string; bio: string | null }>();
  return { title: data?.nickname ?? 'Joueur introuvable', description: data?.bio ?? undefined };
}

export default async function JoueurPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: player } = await supabase
    .from('players')
    .select('id, slug, nickname, real_name, country_code, photo_url, is_professional, bio, socials')
    .eq('slug', slug)
    .maybeSingle<PlayerFull>();
  if (!player) notFound();

  const { data: memberships } = await supabase
    .from('team_members')
    .select('id, role, joined_at, left_at, game:games(slug, name), team:teams(slug, name, logo_url)')
    .eq('player_id', player.id)
    .order('joined_at', { ascending: false })
    .returns<{ id: string; role: string; joined_at: string; left_at: string | null; game: { slug: string; name: string } | null; team: { slug: string; name: string; logo_url: string | null } | null }[]>();

  const rows = (memberships ?? []).filter((m) => m.team);
  const current = rows.filter((m) => !m.left_at);
  const past = rows.filter((m) => m.left_at);
  const socials = Object.entries(player.socials ?? {}).filter(([, url]) => /^https?:\/\//.test(url));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={player.is_professional ? 'violet' : 'neutral'}>{player.is_professional ? 'Joueur professionnel' : 'Joueur amateur'}</Badge>
        </div>
        <h1 className="text-3xl font-bold">{flag(player.country_code)} {player.nickname}</h1>
        {player.real_name && <p className="text-zinc-400">{player.real_name}</p>}
        {player.bio && <p className="mt-3 max-w-2xl text-zinc-300">{player.bio}</p>}
        {socials.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-3 text-sm">
            {socials.map(([name, url]) => (
              <li key={name}>
                <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--accent-blue)] hover:underline">
                  {name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </header>

      <SectionTitle>Équipe actuelle</SectionTitle>
      {current.length === 0 ? (
        <EmptyState>Sans équipe actuellement.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {current.map((m) => (
            <li key={m.id}>
              <Link href={`/equipes/${m.team!.slug}`}>
                <Card className="flex items-center gap-3 p-4 transition hover:border-[var(--accent)]">
                  <Logo src={m.team!.logo_url} name={m.team!.name} size={40} />
                  <span>
                    <span className="block font-medium">{m.team!.name}</span>
                    <span className="text-xs text-zinc-400">{ROLE_LABEL[m.role] ?? m.role}{m.game ? ` · ${m.game.name}` : ''} · depuis le {formatDate(m.joined_at)}</span>
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle>Anciennes équipes</SectionTitle>
          <Card>
            <ul className="divide-y divide-[var(--border)] text-sm">
              {past.map((m) => (
                <li key={m.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                  <Link href={`/equipes/${m.team!.slug}`} className="hover:text-[var(--accent-blue)]">{m.team!.name}</Link>
                  <span className="text-zinc-400">{formatDate(m.joined_at)} → {formatDate(m.left_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </main>
  );
}
