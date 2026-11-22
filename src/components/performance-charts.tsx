'use client';

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const AXIS = { stroke: '#71717a', fontSize: 12 };
const TOOLTIP = { contentStyle: { background: '#11111c', border: '1px solid #23233a', borderRadius: 8 }, labelStyle: { color: '#e4e4e7' } };

interface Day {
  day: string;
  played: number;
  wins: number;
  losses: number;
}

/** Progression : taux de victoire cumulé et résultats par jour. */
export function ProgressCharts({ days }: { days: Day[] }) {
  let wins = 0;
  let decided = 0;
  const cumulative = days.map((d) => {
    wins += d.wins;
    decided += d.wins + d.losses;
    return { day: d.day, rate: decided > 0 ? Math.round((wins / decided) * 1000) / 10 : null };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure>
        <figcaption className="mb-2 text-sm text-zinc-400">Taux de victoire cumulé (%)</figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulative} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid stroke="#23233a" strokeDasharray="3 3" />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis domain={[0, 100]} {...AXIS} />
              <Tooltip {...TOOLTIP} formatter={(value) => `${value} %`} />
              <Line type="monotone" dataKey="rate" name="Taux de victoire" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure>
        <figcaption className="mb-2 text-sm text-zinc-400">Résultats par jour</figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid stroke="#23233a" strokeDasharray="3 3" />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TOOLTIP} />
              <Legend />
              <Bar dataKey="wins" name="Victoires" stackId="r" fill="#22c55e" />
              <Bar dataKey="losses" name="Défaites" stackId="r" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}

/** Évolution du rang / classement (valeurs réellement enregistrées). */
export function RankChart({ points }: { points: { date: string; rating: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#23233a" strokeDasharray="3 3" />
          <XAxis dataKey="date" {...AXIS} />
          <YAxis domain={['auto', 'auto']} {...AXIS} />
          <Tooltip {...TOOLTIP} />
          <Line type="monotone" dataKey="rating" name="Classement" stroke="#3b82f6" strokeWidth={2} dot={points.length < 30} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Comparaison de deux comptes sur une même métrique. */
export function CompareChart({ rows, labelA, labelB }: { rows: { name: string; a: number | null; b: number | null }[]; labelA: string; labelB: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#23233a" strokeDasharray="3 3" />
          <XAxis dataKey="name" {...AXIS} />
          <YAxis {...AXIS} />
          <Tooltip {...TOOLTIP} />
          <Legend />
          <Bar dataKey="a" name={labelA} fill="#7c3aed" />
          <Bar dataKey="b" name={labelB} fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
