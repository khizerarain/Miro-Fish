"use client";

import { enabledSegments, segmentCounts, type AudienceDefinition } from "../schemas";

export function LiveSummary({ definition, size }: { definition: AudienceDefinition; size: number }) {
  const segs = enabledSegments(definition);
  const counts = segmentCounts(definition, size);
  const n = segs.length;
  return (
    <p className="text-sm" aria-live="polite">
      <span className="font-medium">{size.toLocaleString("en-US")} customers</span>
      {n === 0 ? (
        " · turn on a segment to continue"
      ) : (
        <>
          {" "}
          across {n} segment{n === 1 ? "" : "s"}
          <span className="text-muted-foreground">
            {" "}
            ({segs.map((s) => `${s.label} ${counts[s.key] ?? 0}`).join(" · ")})
          </span>
        </>
      )}
    </p>
  );
}
