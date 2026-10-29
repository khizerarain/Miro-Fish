"use client";

import { LayoutGrid, List, Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchPersonaPage, saveAudienceTemplate } from "../actions";
import { INCOME_BANDS } from "../constants";
import { profileOf } from "../profile";
import type { AudienceDefinition, PersonaProfile } from "../schemas";
import { StartSimulationCard } from "@/features/simulations/start-card";
import { DemoCharts } from "./demo-charts";
import { PersonaDrawer } from "./persona-drawer";

type Row = {
  id: string;
  ordinal: number;
  name: string;
  age: number;
  profession: string | null;
  location: string | null;
  segmentKey: string;
  incomeBand: string | null;
  profile: unknown;
};

type Charts = {
  total: number;
  bySegment: Record<string, number>;
  byIncome: Record<string, number>;
  byAge: { bucket: string; n: number }[];
};

export function AudiencePreview({
  experimentId,
  audienceId,
  audienceName,
  definition,
  initialRows,
  initialTotal,
  initialCharts,
  mockMode,
  onRegenerate,
}: {
  experimentId: string;
  audienceId: string;
  audienceName: string;
  definition: AudienceDefinition;
  initialRows: Row[];
  initialTotal: number;
  initialCharts: Charts;
  mockMode: boolean;
  onRegenerate: () => void;
}) {
  const labels = useMemo(() => Object.fromEntries(definition.segments.map((s) => [s.key, s.label])), [definition]);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [charts, setCharts] = useState(initialCharts);
  const [segment, setSegment] = useState("all");
  const [income, setIncome] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<PersonaProfile | null>(null);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);

  function reload(next?: { segment?: string; income?: string; q?: string }) {
    const s = next?.segment ?? segment;
    const inc = next?.income ?? income;
    const query = next?.q ?? q;
    start(async () => {
      const res = await fetchPersonaPage(audienceId, {
        segment: s === "all" ? undefined : s,
        income: inc === "all" ? undefined : inc,
        q: query || undefined,
        limit: 48,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows(res.page.rows);
      setTotal(res.page.total);
      setCharts(res.charts);
    });
  }

  async function saveTemplate() {
    setSaving(true);
    const res = await saveAudienceTemplate(audienceId, `${audienceName} template`);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Saved as a reusable template");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow-caps">Audience</p>
          <h1 className="font-display text-title">{audienceName}</h1>
          <p className="text-muted-foreground">{charts.total.toLocaleString("en-US")} simulated customers</p>
          <div className="mt-2">
            <SimulatedBadge />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveTemplate} disabled={saving}>
            <Save /> Save as template
          </Button>
          <Button variant="outline" onClick={onRegenerate}>
            Generate again
          </Button>
        </div>
      </div>

      <StartSimulationCard experimentId={experimentId} personaCount={charts.total} mockMode={mockMode} />

      <DemoCharts charts={charts} labels={labels} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          placeholder="Search name, job, city"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => reload()}
          onKeyDown={(e) => e.key === "Enter" && reload()}
          className="lg:max-w-xs"
        />
        <Select
          value={segment}
          onValueChange={(v) => {
            setSegment(v);
            reload({ segment: v });
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter by segment">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All segments</SelectItem>
            {definition.segments.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={income}
          onValueChange={(v) => {
            setIncome(v);
            reload({ income: v });
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by income">
            <SelectValue placeholder="Income" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All incomes</SelectItem>
            {INCOME_BANDS.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-1">
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" aria-label="Grid view" onClick={() => setView("grid")}>
            <LayoutGrid />
          </Button>
          <Button variant={view === "table" ? "secondary" : "ghost"} size="icon" aria-label="Table view" onClick={() => setView("table")}>
            <List />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {rows.length} of {total.toLocaleString("en-US")}
        {pending ? " · updating…" : ""}
      </p>

      {view === "grid" ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                aria-label={`Open ${r.name}`}
                onClick={() => {
                  const p = profileOf(r);
                  if (p) setOpen(p);
                  else toast.error("Couldn't read this persona.");
                }}
                className="w-full rounded-xl border bg-card p-4 text-left shadow-soft transition-colors hover:bg-muted/40"
              >
                <p className="font-medium">{r.name}</p>
                <p className="text-sm text-muted-foreground">
                  {r.age} · {r.profession}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {labels[r.segmentKey] ?? r.segmentKey} · {r.location}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Profession</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => {
                  const p = profileOf(r);
                  if (p) setOpen(p);
                  else toast.error("Couldn't read this persona.");
                }}
              >
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.age}</TableCell>
                <TableCell>{r.profession}</TableCell>
                <TableCell>{labels[r.segmentKey] ?? r.segmentKey}</TableCell>
                <TableCell>{r.location}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <PersonaDrawer
        persona={open}
        segmentLabel={open ? (labels[open.segmentKey] ?? open.segmentKey) : ""}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
