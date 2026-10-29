"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { INCOME_BANDS } from "../constants";

type Charts = {
  bySegment: Record<string, number>;
  byIncome: Record<string, number>;
  byAge: { bucket: string; n: number }[];
};

const tooltip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
};

export function DemoCharts({ charts, labels }: { charts: Charts; labels: Record<string, string> }) {
  const segments = Object.entries(charts.bySegment).map(([key, n]) => ({ name: labels[key] ?? key, n }));
  const income = INCOME_BANDS.map((b) => ({ name: b.label, n: charts.byIncome[b.id] ?? 0 })).filter((d) => d.n > 0);
  const age = charts.byAge.map((b) => ({ name: `${b.bucket}s`, n: b.n }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <ChartCard title="By segment" data={segments} />
      <ChartCard title="By age" data={age} />
      <ChartCard title="By income" data={income} />
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: { name: string; n: number }[] }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-eyebrow-caps mb-3">{title}</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} height={48} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip {...tooltip} />
            <Bar dataKey="n" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
