"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LIMITS } from "../schemas";
import { DESCRIPTION_TIPS, EXAMPLE_IDEAS } from "./examples";

function guidance(length: number): { text: string; tone: "muted" | "warn" | "good" } {
  if (length === 0) return { text: "A few sentences is enough to start.", tone: "muted" };
  if (length < LIMITS.descriptionMin) return { text: "Too short to analyze yet.", tone: "warn" };
  if (length < LIMITS.descriptionIdealMin)
    return { text: "Add a bit more: who it's for and what problem it solves.", tone: "muted" };
  if (length <= LIMITS.descriptionIdealMax) return { text: "Good level of detail.", tone: "good" };
  return { text: "Plenty of detail. We'll focus on the essentials.", tone: "good" };
}

export function DescribeTab({
  value,
  onChange,
  onExample,
}: {
  value: string;
  onChange: (v: string) => void;
  onExample: (example: (typeof EXAMPLE_IDEAS)[number]) => void;
}) {
  const g = guidance(value.trim().length);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_14rem]">
      <div className="space-y-2">
        <Label htmlFor="idea-description">Describe your idea</Label>
        <Textarea
          id="idea-description"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          maxLength={LIMITS.description}
          placeholder="Who is it for, what problem does it solve, and how does it work?"
          aria-describedby="idea-description-guidance"
          className="min-h-56 resize-y leading-relaxed"
        />
        <div
          id="idea-description-guidance"
          className="flex items-center justify-between gap-4 text-xs"
          aria-live="polite"
        >
          <span
            className={cn(
              g.tone === "warn" && "text-destructive",
              g.tone === "good" && "text-primary",
              g.tone === "muted" && "text-muted-foreground",
            )}
          >
            {g.text}
          </span>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {value.length.toLocaleString("en-US")} / {LIMITS.description.toLocaleString("en-US")}
          </span>
        </div>

        {value.trim().length === 0 && (
          <div className="space-y-2 pt-4">
            <p className="text-eyebrow-caps">Or start from an example</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_IDEAS.map((ex) => (
                <Button key={ex.label} type="button" variant="outline" size="sm" onClick={() => onExample(ex)}>
                  <Sparkles className="text-primary" aria-hidden="true" />
                  {ex.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-3 rounded-xl bg-muted/50 p-5 text-sm">
        <p className="font-medium">A strong description covers</p>
        <ul className="space-y-2 text-muted-foreground">
          {DESCRIPTION_TIPS.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
              {tip}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
