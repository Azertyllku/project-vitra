import Link from 'next/link';
import { Badge, Card, Logo, StatusBadge } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { MatchRow } from '@/lib/data/types';

export function MatchCard({ match }: { match: MatchRow }) {
  const showScore = match.status === 'live' || match.status === 'finished';
  return (
    <Link href={`/matchs/${match.id}`} className="group block">
      <Card className="p-4 transition group-hover:border-[var(--accent)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <span>
            {match.game?.name ?? 'Jeu inconnu'}
            {match.tournament ? ` · ${match.tournament.name}` : ''}
            {match.round_label ? ` · ${match.round_label}` : ''}
          </span>
          <span className="flex items-center gap-2">
            {match.data_source === 'demo' && <Badge tone="amber">Démonstration</Badge>}
            <StatusBadge status={match.status} />
          </span>
        </div>
        <ul className="space-y-2">
          {match.teams.map((entry) => {
            const name = entry.team?.name ?? entry.placeholder_label ?? 'À déterminer';
            return (
              <li key={entry.slot} className="flex items-center gap-3">
                <Logo src={entry.team?.logo_url ?? null} name={name} size={32} />
                <span className={`flex-1 truncate ${entry.is_winner ? 'font-semibold' : ''}`}>{name}</span>
                {showScore && <span className="font-mono text-lg tabular-nums">{entry.score ?? '—'}</span>}
              </li>
            );
          })}
          {match.teams.length === 0 && <li className="text-sm text-zinc-500">Participants à confirmer</li>}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          {formatDateTime(match.scheduled_at)}
          {match.best_of ? ` · BO${match.best_of}` : ''}
        </p>
      </Card>
    </Link>
  );
}

export function MatchGrid({ matches }: { matches: MatchRow[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {matches.map((match) => (
        <li key={match.id}>
          <MatchCard match={match} />
        </li>
      ))}
    </ul>
  );
}
