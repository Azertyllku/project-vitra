'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Graphique supplémentaire (Premium) : taux de victoire par carte / personnage / rôle. */
export function DimChart({ rows }: { rows: { name: string; played: number; wins: number }[] }) {
  const data = rows.map((r) => ({ name: r.name, rate: Math.round((r.wins / r.played) * 1000) / 10, played: r.played }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid stroke="#23233a" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
          <YAxis domain={[0, 100]} stroke="#71717a" fontSize={12} />
          <Tooltip
            contentStyle={{ background: '#11111c', border: '1px solid #23233a', borderRadius: 8 }}
            formatter={(value, _name, item) => [`${value} % (${(item.payload as { played: number }).played} parties)`, 'Taux de victoire']}
          />
          <Bar dataKey="rate" fill="#7c3aed" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
