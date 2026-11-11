"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { renameProject } from "@/features/projects/actions";
import type { RunSnapshot } from "./types";

const TrendChart = dynamic(() => import("./trend-chart").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

type Run = {
  id: string;
  name: string;
  status: string;
  changeSummary: string | null;
  parentExperimentId: string | null;
  createdAt: Date;
};

export function ProjectTimeline({
  projectId,
  projectName,
  runs,
  series,
}: {
  projectId: string;
  projectName: string;
  runs: Run[];
  series: RunSnapshot[];
}) {
  const complete = runs.filter((r) => r.status === "complete" || r.status === "analyzing");
  const [a, setA] = useState(complete[1]?.id ?? complete[0]?.id ?? "");
  const [b, setB] = useState(complete[0]?.id ?? "");
  const [name, setName] = useState(projectName);
  const [pending, start] = useTransition();
  const router = useRouter();

  const chart = useMemo(
    () =>
      series.map((s) => ({
        name: s.name.slice(0, 18),
        interest: s.meanInterest ?? 0,
        n: s.n,
      })),
    [series],
  );

  const objectionSeries = useMemo(() => {
    const keys = [...new Set(series.flatMap((s) => s.topObjections.slice(0, 3).map((o) => o.text)))].slice(0, 4);
    return keys.map((text) => ({
      text,
      points: series.map((s) => ({ name: s.name.slice(0, 18), pct: s.topObjections.find((o) => o.text === text)?.pct ?? 0 })),
    }));
  }, [series]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow-caps">Project</p>
          <h1 className="font-display text-title">{projectName}</h1>
          <p className="text-muted-foreground">History of simulated runs. Numbers are counted from stored reactions.</p>
          <div className="mt-2">
            <SimulatedBadge />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await renameProject(projectId, name);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Renamed");
                router.refresh();
              });
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Project name" className="w-48" />
            <Button type="submit" variant="outline" disabled={pending || name.trim() === projectName}>
              Rename
            </Button>
          </form>
          <Button variant="outline" asChild>
            <Link href="/projects">All projects</Link>
          </Button>
        </div>
      </div>

      {chart.length >= 2 && (
        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="text-subheading font-medium">Simulated interest over runs</h2>
          <TrendChart data={chart} />
        </section>
      )}

      {objectionSeries.length > 0 && series.length >= 2 && (
        <section className="space-y-3">
          <h2 className="text-subheading font-medium">Top objections across runs</h2>
          <ul className="space-y-2">
            {objectionSeries.map((o, i) => (
              <li key={`${i}-${o.text}`} className="rounded-lg border p-3 text-sm">
                <p>{o.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.points.map((p) => `${p.name} ${p.pct}%`).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-subheading font-medium">Timeline</h2>
        <ol className="space-y-3">
          {runs.map((r) => (
            <li key={r.id} className="rounded-xl border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={hrefFor(r)} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.status} · {r.createdAt.toLocaleString()}
                  </p>
                  {r.changeSummary && <p className="mt-1 text-sm text-pretty">{r.changeSummary}</p>}
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={hrefFor(r)}>Open</Link>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {complete.length >= 2 && (
        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="text-subheading font-medium">Compare two runs</h2>
          <div className="flex flex-wrap gap-3">
            <Select value={a} onValueChange={setA}>
              <SelectTrigger className="w-56" aria-label="First run">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {complete.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={b} onValueChange={setB}>
              <SelectTrigger className="w-56" aria-label="Second run">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {complete.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {a && b && a !== b ? (
              <Button asChild>
                <Link href={`/projects/${projectId}/compare?a=${a}&b=${b}`}>Compare</Link>
              </Button>
            ) : (
              <Button disabled>Compare</Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function hrefFor(r: Run) {
  if (r.status === "complete" || r.status === "analyzing") return `/experiments/${r.id}/results`;
  if (r.status === "simulating" || r.status === "queued" || r.status === "cancelled") return `/experiments/${r.id}/simulate`;
  return `/experiments/${r.id}/audience`;
}
