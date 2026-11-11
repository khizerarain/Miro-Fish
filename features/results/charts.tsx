"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
};

export function SimpleBar({
  data,
  xKey = "name",
  yKey = "n",
  height = 176,
  onBarClick,
}: {
  data: Record<string, string | number>[];
  xKey?: string;
  yKey?: string;
  height?: number;
  onBarClick?: (name: string) => void;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} interval={0} height={44} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip {...tooltip} />
          <Bar
            dataKey={yKey}
            fill="var(--color-chart-1)"
            radius={[4, 4, 0, 0]}
            cursor={onBarClick ? "pointer" : undefined}
            onClick={(d) => {
              const name = (d as { payload?: { name?: string } }).payload?.name;
              if (name && onBarClick) onBarClick(name);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedHeat({
  rows,
}: {
  rows: { name: string; interested: number; ignoring: number; hostile: number }[];
}) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} />
          <Tooltip {...tooltip} />
          <Bar dataKey="interested" stackId="a" fill="var(--color-chart-1)" name="Interested" radius={[0, 0, 0, 0]} />
          <Bar dataKey="ignoring" stackId="a" fill="var(--color-chart-3)" name="Ignoring" />
          <Bar dataKey="hostile" stackId="a" fill="var(--color-chart-4)" name="Hostile" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IntentBars({
  data,
}: {
  data: { name: string; n: number }[];
}) {
  const colors = ["var(--color-chart-4)", "var(--color-chart-5)", "var(--color-chart-2)", "var(--color-chart-1)"];
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip {...tooltip} />
          <Bar dataKey="n" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
