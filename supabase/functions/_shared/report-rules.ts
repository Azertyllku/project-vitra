/**
 * Rapports automatiques par règles : utilisés quand aucune clé d'IA n'est configurée, ou quand les données sont
 * trop maigres pour qu'un modèle de langage soit pertinent. Tout est déduit des données fournies, rien d'autre.
 */
export interface Dim { name: string; played: number; wins: number }
export interface Totals { played: number; wins: number; losses: number; draws: number }
export interface Perf extends Totals {
  seconds: number;
  streak: { kind: 'win' | 'loss' | null; length: number };
  by_source: Record<string, number>;
  by_map: Dim[];
  by_character: Dim[];
  by_role: Dim[];
  stat_averages: Record<string, { avg: number; n: number }>;
}

const MIN_SAMPLE = 5;
const rate = (t: Totals): number | null => {
  const decided = t.wins + t.losses + t.draws;
  return decided > 0 ? Math.round((t.wins / decided) * 1000) / 10 : null;
};
const playtime = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`;

export function performanceReport(ctx: {
  game: string;
  periodLabel: string;
  current: Perf;
  previous: Totals | null;
  labels: Record<string, { label: string; unit: string | null }>;
}): string {
  const { current: c, previous: p, game, periodLabel } = ctx;
  const sources = Object.entries(c.by_source).map(([k, v]) => `${k} ${v}`).join(', ') || 'aucune';
  if (c.played < MIN_SAMPLE) {
    return [
      `Résumé`,
      `Sur la période « ${periodLabel} », ${c.played} partie${c.played > 1 ? 's' : ''} enregistrée${c.played > 1 ? 's' : ''} sur ${game} : c'est insuffisant pour dégager des tendances fiables (minimum ${MIN_SAMPLE}).`,
      ``,
      `Conseils`,
      `Enregistrez davantage de parties (ou lancez une synchronisation si votre compte le permet) pour obtenir une analyse exploitable.`,
    ].join('\n');
  }

  const overall = rate(c);
  const out: string[] = ['Résumé'];
  out.push(`Sur ${periodLabel}, ${c.played} parties de ${game} : ${c.wins} victoires, ${c.losses} défaites${c.draws ? `, ${c.draws} égalités` : ''}${overall != null ? ` (${overall} % de victoires)` : ''}.`);
  if (c.seconds > 0) out.push(`Temps de jeu enregistré : ${playtime(c.seconds)} (parties dont la durée est connue).`);

  if (p && p.wins + p.losses + p.draws >= MIN_SAMPLE && overall != null) {
    const before = rate(p);
    if (before != null) {
      const diff = Math.round((overall - before) * 10) / 10;
      out.push(diff >= 5 ? `Évolution : progression de ${diff} points par rapport à la période précédente (${before} %).`
        : diff <= -5 ? `Évolution : recul de ${Math.abs(diff)} points par rapport à la période précédente (${before} %).`
        : `Évolution : taux de victoire stable par rapport à la période précédente (${before} %).`);
    }
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const advice: string[] = [];
  const dims: [string, Dim[]][] = [['Carte', c.by_map], ['Personnage', c.by_character], ['Rôle', c.by_role]];
  if (overall != null) {
    for (const [kind, rows] of dims) {
      const eligible = rows.filter((r) => r.played >= MIN_SAMPLE).map((r) => ({ ...r, rate: Math.round((r.wins / r.played) * 1000) / 10 }));
      if (eligible.length < 2) continue;
      const best = eligible.reduce((a, b) => (b.rate > a.rate ? b : a));
      const worst = eligible.reduce((a, b) => (b.rate < a.rate ? b : a));
      if (best.rate - overall >= 10) strengths.push(`${kind} « ${best.name} » : ${best.rate} % de victoires sur ${best.played} parties.`);
      if (overall - worst.rate >= 10) {
        weaknesses.push(`${kind} « ${worst.name} » : ${worst.rate} % de victoires sur ${worst.played} parties.`);
        advice.push(`Analysez vos parties sur ${kind.toLowerCase()} « ${worst.name} » (${worst.rate} % de victoires sur ${worst.played} parties) pour comprendre ce qui coince.`);
      }
    }
  }

  const stats = Object.entries(c.stat_averages).filter(([key]) => ctx.labels[key]).slice(0, 6)
    .map(([key, v]) => `${ctx.labels[key].label} : ${v.avg}${ctx.labels[key].unit ? ' ' + ctx.labels[key].unit : ''} en moyenne (sur ${v.n} partie${v.n > 1 ? 's' : ''})`);

  if (c.streak.kind === 'loss' && c.streak.length >= 3) advice.push(`Vous êtes sur ${c.streak.length} défaites consécutives : une pause ou une revue de vos dernières parties peut aider.`);
  if (c.streak.kind === 'win' && c.streak.length >= 3) strengths.push(`Série de ${c.streak.length} victoires en cours.`);
  if (advice.length === 0) advice.push('Continuez à enregistrer vos parties : plus de données permettent des conseils plus précis.');

  out.push('', 'Points forts', ...(strengths.length ? strengths.map((s) => `- ${s}`) : ['- Aucun point fort net ne ressort des données actuelles.']));
  out.push('', 'Points à travailler', ...(weaknesses.length ? weaknesses.map((s) => `- ${s}`) : ['- Aucune faiblesse nette ne ressort des données actuelles.']));
  if (stats.length) out.push('', 'Statistiques moyennes', ...stats.map((s) => `- ${s}`));
  out.push('', 'Conseils', ...advice.map((s) => `- ${s}`));
  out.push('', `Limites : analyse fondée sur ${c.played} parties enregistrées (provenance : ${sources}).`);
  return out.join('\n');
}

export interface MatchCtx {
  status: string;
  game: string | null;
  tournament: string | null;
  round: string | null;
  bestOf: number | null;
  scheduledAt: string | null;
  teams: { name: string; score: number | null; isWinner: boolean | null }[];
  statRows: number;
}

export function matchReport(ctx: MatchCtx): string {
  const names = ctx.teams.map((t) => t.name);
  const meta = [ctx.game, ctx.tournament, ctx.round, ctx.bestOf ? `BO${ctx.bestOf}` : null].filter(Boolean).join(' · ');
  const scoreLine = ctx.teams.map((t) => `${t.name} ${t.score ?? '—'}`).join(' - ');
  const out: string[] = ['Résumé'];
  if (ctx.teams.length === 0) out.push('Les participants de ce match ne sont pas encore connus.');
  else if (ctx.status === 'finished') {
    const winner = ctx.teams.find((t) => t.isWinner);
    out.push(winner ? `${winner.name} remporte le match (${scoreLine}).` : `Match terminé : ${scoreLine}. Aucun vainqueur n'est enregistré.`);
  } else if (ctx.status === 'live') out.push(`Match en cours : ${scoreLine}.`);
  else if (ctx.status === 'scheduled') out.push(`Match programmé entre ${names.join(' et ')}${ctx.scheduledAt ? ` le ${ctx.scheduledAt}` : ''}.`);
  else out.push(`Statut du match : ${ctx.status}. Participants : ${names.join(', ')}.`);
  if (meta) out.push(`Contexte : ${meta}.`);
  out.push('', 'Statistiques', ctx.statRows > 0 ? `${ctx.statRows} ligne(s) de statistiques détaillées sont disponibles sur la fiche du match.` : "Aucune statistique détaillée n'a été fournie pour ce match.");
  out.push('', 'Limites : résumé établi uniquement à partir du score et du statut enregistrés.');
  return out.join('\n');
}

export interface TournamentCtx {
  name: string;
  status: string;
  game: string | null;
  format: string;
  participants: number;
  standings: { rank: number; team: string; wins: number; losses: number }[];
  finishedMatches: number;
  lastResults: string[];
}

export function tournamentReport(ctx: TournamentCtx): string {
  const out: string[] = ['Résumé'];
  out.push(`${ctx.name} (${ctx.game ?? 'jeu inconnu'}) : tournoi ${ctx.status}, format ${ctx.format}, ${ctx.participants} participant${ctx.participants > 1 ? 's' : ''} enregistré${ctx.participants > 1 ? 's' : ''}.`);
  out.push(`${ctx.finishedMatches} match${ctx.finishedMatches > 1 ? 's' : ''} terminé${ctx.finishedMatches > 1 ? 's' : ''} enregistré${ctx.finishedMatches > 1 ? 's' : ''}.`);
  out.push('', 'Classement', ...(ctx.standings.length ? ctx.standings.slice(0, 5).map((s) => `${s.rank}. ${s.team} (${s.wins}V - ${s.losses}D)`) : ["Aucun classement n'est enregistré pour ce tournoi."]));
  if (ctx.lastResults.length) out.push('', 'Derniers résultats', ...ctx.lastResults.slice(0, 5).map((r) => `- ${r}`));
  out.push('', "Limites : résumé établi uniquement à partir des données enregistrées sur ESPORT HUB.");
  return out.join('\n');
}
