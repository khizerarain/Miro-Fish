"use client";

import { Badge } from "@/components/ui/badge";
import { ImproveButton } from "@/features/improve/dialog";
import { Panel } from "../panel";
import type { NarrativePayload } from "../schemas";

const tone: Record<string, string> = {
  high: "bg-primary text-primary-foreground",
  medium: "bg-brand-soft text-brand-soft-foreground",
  low: "bg-muted text-muted-foreground",
};

export function Recommendations({
  narrative,
  experimentId,
  shareMode,
}: {
  narrative: NarrativePayload | null;
  experimentId?: string;
  shareMode?: boolean;
}) {
  const items = [...(narrative?.recommendations ?? [])].sort((a, b) => rank(a.impact) - rank(b.impact));
  return (
    <Panel eyebrow="Recommendations" title="What to try next, in order">
      {!items.length && <p className="text-sm text-muted-foreground">Notes still generating.</p>}
      <ol className="space-y-3">
        {items.map((r, i) => (
          <li key={r.title} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <p className="font-medium">{r.title}</p>
              <Badge className={tone[r.impact] ?? tone.medium}>Impact {r.impact}</Badge>
              <Badge variant="outline">Effort {r.effort}</Badge>
            </div>
            <p className="mt-2 text-sm text-pretty">{r.detail}</p>
            <p className="mt-1 text-xs text-muted-foreground">Evidence: {r.evidence}</p>
            {!shareMode && experimentId && (
              <div className="mt-3">
                <ImproveButton
                  experimentId={experimentId}
                  recommendation={{ title: r.title, detail: r.detail, evidence: r.evidence }}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function rank(impact: string) {
  return impact === "high" ? 0 : impact === "medium" ? 1 : 2;
}
