"use client";

import { TalkButton } from "./drawer";
import type { CompactReaction } from "@/features/results/schemas";
import { Panel } from "@/features/results/panel";

export function PeopleStrip({
  rows,
  labels,
  onTalk,
}: {
  rows: CompactReaction[];
  labels: Record<string, string>;
  onTalk: (row: CompactReaction) => void;
}) {
  const shown = rows.slice(0, 8);
  if (!shown.length) return null;
  return (
    <Panel eyebrow="Customers" title="Talk to someone from this run">
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="font-medium">{r.personaName}</p>
              <p className="text-xs text-muted-foreground">
                {labels[r.segmentKey] ?? r.segmentKey} · score {r.interestScore}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-pretty">{r.firstImpression}</p>
            </div>
            <TalkButton onClick={() => onTalk(r)} label={`Talk with ${r.personaName}`} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
