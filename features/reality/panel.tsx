"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/features/results/panel";
import { importReality } from "./actions";
import type { RealityCompare } from "./schemas";

export function RealityPanel({
  experimentId,
  initial,
}: {
  experimentId: string;
  initial: RealityCompare | null;
}) {
  const [compare, setCompare] = useState(initial);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(filename: string, text: string) {
    setBusy(true);
    const res = await importReality(experimentId, filename, text);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setCompare(res.compare);
    toast.success("Imported. This is a directional check, not validation.");
  }

  return (
    <Panel eyebrow="Reality check" title="Compare against real notes">
      <p className="text-sm text-muted-foreground">
        Upload a CSV (interest, intent, objection, quote) or paste interview notes. Overlap is a hypothesis prompt, not proof.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <label className="cursor-pointer">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                void send(file.name, text);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
      </div>
      <Textarea
        className="mt-3"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Paste interview notes…"
        aria-label="Interview notes"
      />
      <Button type="button" size="sm" className="mt-2" disabled={busy || notes.trim().length < 8} onClick={() => void send("notes.txt", notes)}>
        Compare notes
      </Button>
      {compare && (
        <div className="mt-4 space-y-2 text-sm">
          <p>
            Imported n={compare.importedN}
            {compare.importedMean != null ? ` · mean ${compare.importedMean}` : ""}
            {" vs "}
            simulated n={compare.simulatedN}
            {compare.simulatedMean != null ? ` · mean ${compare.simulatedMean}` : ""}
            {compare.meanDelta != null ? ` · Δ ${compare.meanDelta}` : ""}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {compare.objectionOverlap.slice(0, 5).map((o, i) => (
              <li key={`${i}-${o.text}`}>
                {o.text} · simulated {o.simulated} · imported {o.imported}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{compare.caution}</p>
        </div>
      )}
    </Panel>
  );
}
