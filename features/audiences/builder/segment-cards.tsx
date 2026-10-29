"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { slug, type AudienceSegment } from "../schemas";

export function SegmentCards({
  segments,
  onChange,
}: {
  segments: AudienceSegment[];
  onChange: (s: AudienceSegment[]) => void;
}) {
  const [label, setLabel] = useState("");
  const set = (i: number, patch: Partial<AudienceSegment>) =>
    onChange(segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-subheading font-medium">Segments</h2>
          <p className="text-sm text-muted-foreground">Suggested from the analysis. Toggle any off, or add your own.</p>
        </div>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {segments.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              "space-y-4 rounded-xl border p-4 shadow-soft",
              s.enabled ? "bg-card" : "bg-muted/30 opacity-80",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{s.label}</p>
                {s.rationale && <p className="mt-1 text-sm text-muted-foreground">{s.rationale}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={s.enabled} onCheckedChange={(v) => set(i, { enabled: v })} aria-label={`Include ${s.label}`} />
                {s.custom && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${s.label}`}
                    onClick={() => onChange(segments.filter((_, idx) => idx !== i))}
                  >
                    <X />
                  </Button>
                )}
              </div>
            </div>
            {s.enabled && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Weight</span>
                  <span>{s.weight}</span>
                </div>
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[s.weight]}
                  onValueChange={([v]) => set(i, { weight: v ?? 1 })}
                  aria-label={`Weight for ${s.label}`}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {segments.length < 8 && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const name = label.trim();
            if (!name) return;
            onChange([
              ...segments,
              { key: `c-${slug(name)}-${segments.length}`, label: name, rationale: "", weight: 20, enabled: true, custom: true },
            ]);
            setLabel("");
          }}
        >
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add a custom segment" maxLength={100} />
          <Button type="submit" variant="outline">
            <Plus /> Add segment
          </Button>
        </form>
      )}
    </div>
  );
}
