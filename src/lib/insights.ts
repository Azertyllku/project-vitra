import { winRate, type Dim, type Performance } from '@/lib/data/performance';

const MIN_SAMPLE = 5;

type Totals = { played: number; wins: number; losses: number; draws: number };

/**
 * Observations dérivées UNIQUEMENT des statistiques réellement enregistrées.
 * Chaque phrase indique la taille de l'échantillon ; en dessous de 5 parties, aucune tendance n'est avancée.
 */
export function buildInsights(current: Performance, previous: Totals | null): string[] {
  if (current.played < MIN_SAMPLE) {
    return [`Seulement ${current.played} partie${current.played > 1 ? 's' : ''} sur cette période : pas assez de données pour dégager des tendances fiables (minimum ${MIN_SAMPLE}).`];
  }
  const insights: string[] = [];
  const overall = winRate(current);

  if (overall != null && previous && previous.wins + previous.losses + previous.draws >= MIN_SAMPLE) {
    const before = winRate(previous);
    if (before != null) {
      const diff = overall - before;
      if (diff >= 5) insights.push(`Ton taux de victoire progresse : ${overall} % contre ${before} % sur la période précédente.`);
      else if (diff <= -5) insights.push(`Ton taux de victoire recule : ${overall} % contre ${before} % sur la période précédente.`);
      else insights.push(`Ton taux de victoire est stable : ${overall} % contre ${before} % sur la période précédente.`);
    }
  }

  const dims: [string, Dim[]][] = [
    ['Carte', current.by_map],
    ['Personnage', current.by_character],
    ['Rôle', current.by_role],
  ];
  if (overall != null) {
    for (const [kind, rows] of dims) {
      const eligible = rows.filter((r) => r.played >= MIN_SAMPLE).map((r) => ({ ...r, rate: Math.round((r.wins / r.played) * 1000) / 10 }));
      if (eligible.length < 2) continue;
      const best = eligible.reduce((a, b) => (b.rate > a.rate ? b : a));
      const worst = eligible.reduce((a, b) => (b.rate < a.rate ? b : a));
      if (best.rate - overall >= 10) insights.push(`${kind} « ${best.name} » : ${best.rate} % de victoires sur ${best.played} parties, au-dessus de ta moyenne (${overall} %).`);
      if (overall - worst.rate >= 10) insights.push(`${kind} « ${worst.name} » : ${worst.rate} % de victoires sur ${worst.played} parties, en dessous de ta moyenne (${overall} %).`);
    }
  }

  if (current.streak.kind && current.streak.length >= 3) {
    insights.push(current.streak.kind === 'win' ? `Série de ${current.streak.length} victoires en cours.` : `Série de ${current.streak.length} défaites en cours.`);
  }

  if (insights.length === 0) insights.push(`Sur ${current.played} parties, aucune tendance marquée ne se dégage pour le moment.`);
  return insights;
}
