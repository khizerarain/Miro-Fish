"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Analysis } from "../schemas";
import { ListEditor } from "./list-editor";

type Risk = Analysis["keyAssumptions"][number]["risk"];
const RISK_LABEL: Record<Risk, string> = { high: "High risk", medium: "Medium risk", low: "Low risk" };

function Field({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-eyebrow-caps">
        {label}
      </Label>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

const invalid = (v: string) => v.trim().length === 0;

export function AnalysisCard({ value, onChange }: { value: Analysis; onChange: (a: Analysis) => void }) {
  const set = <K extends keyof Analysis>(key: K, v: Analysis[K]) => onChange({ ...value, [key]: v });

  return (
    <Card className="gap-0 py-0 shadow-soft">
      <CardHeader className="border-b py-6">
        <CardTitle className="font-display text-heading font-normal">
          <h2>Here&apos;s what we understood</h2>
        </CardTitle>
        <CardDescription>
          This is the AI&apos;s reading of your inputs, and some of it is educated guesswork. Fix anything that&apos;s
          off. Your edits are what the simulated customers will be shown.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y p-0 [&>*]:px-6 [&>*]:py-6">
        <Field id="an-summary" label="In one line">
          <Textarea
            id="an-summary"
            rows={2}
            value={value.summary}
            aria-invalid={invalid(value.summary)}
            onChange={(e) => set("summary", e.target.value)}
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="an-industry" label="Industry">
            <Input
              id="an-industry"
              value={value.industry}
              aria-invalid={invalid(value.industry)}
              onChange={(e) => set("industry", e.target.value)}
            />
          </Field>
          <Field id="an-category" label="Category">
            <Input
              id="an-category"
              value={value.category}
              aria-invalid={invalid(value.category)}
              onChange={(e) => set("category", e.target.value)}
            />
          </Field>
        </div>

        <Field id="an-value" label="Value proposition">
          <Textarea
            id="an-value"
            rows={3}
            value={value.valueProposition}
            aria-invalid={invalid(value.valueProposition)}
            onChange={(e) => set("valueProposition", e.target.value)}
          />
        </Field>

        <Field label="Target market guesses" hint="Who we think it's for. These become audience segments next.">
          <ListEditor
            items={value.targetMarkets}
            onChange={(v) => set("targetMarkets", v)}
            min={1}
            max={5}
            addLabel="Add segment"
            create={() => ({ segment: "", rationale: "" })}
            itemLabel={(m, i) => m.segment || `segment ${i + 1}`}
            render={(m, update, i) => (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label={`Segment ${i + 1}`}
                  placeholder="Segment"
                  value={m.segment}
                  aria-invalid={invalid(m.segment)}
                  onChange={(e) => update({ ...m, segment: e.target.value })}
                />
                <Input
                  aria-label={`Why segment ${i + 1}`}
                  placeholder="Why they'd care"
                  value={m.rationale}
                  aria-invalid={invalid(m.rationale)}
                  onChange={(e) => update({ ...m, rationale: e.target.value })}
                />
              </div>
            )}
          />
        </Field>

        <Field label="Key features">
          <ListEditor
            items={value.keyFeatures}
            onChange={(v) => set("keyFeatures", v)}
            min={1}
            max={8}
            addLabel="Add feature"
            create={() => ""}
            itemLabel={(f, i) => f || `feature ${i + 1}`}
            render={(f, update, i) => (
              <Input
                aria-label={`Feature ${i + 1}`}
                value={f}
                aria-invalid={invalid(f)}
                onChange={(e) => update(e.target.value)}
              />
            )}
          />
        </Field>

        <Field id="an-pricing" label="Pricing">
          <Textarea
            id="an-pricing"
            rows={2}
            value={value.pricingSummary}
            aria-invalid={invalid(value.pricingSummary)}
            onChange={(e) => set("pricingSummary", e.target.value)}
          />
        </Field>

        <Field
          label="Likely alternatives and competitors"
          hint="What customers would compare you against, including doing nothing."
        >
          <ListEditor
            items={value.likelyCompetitors}
            onChange={(v) => set("likelyCompetitors", v)}
            max={6}
            addLabel="Add competitor"
            create={() => ({ name: "", whyRelevant: "" })}
            itemLabel={(c, i) => c.name || `competitor ${i + 1}`}
            render={(c, update, i) => (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label={`Competitor ${i + 1}`}
                  placeholder="Name"
                  value={c.name}
                  aria-invalid={invalid(c.name)}
                  onChange={(e) => update({ ...c, name: e.target.value })}
                />
                <Input
                  aria-label={`Why competitor ${i + 1} matters`}
                  placeholder="Why it's relevant"
                  value={c.whyRelevant}
                  aria-invalid={invalid(c.whyRelevant)}
                  onChange={(e) => update({ ...c, whyRelevant: e.target.value })}
                />
              </div>
            )}
          />
        </Field>

        <Field
          label="Key assumptions to test"
          hint="The beliefs your idea depends on. The simulation will probe these."
        >
          <ListEditor
            items={value.keyAssumptions}
            onChange={(v) => set("keyAssumptions", v)}
            min={2}
            max={6}
            addLabel="Add assumption"
            create={() => ({ assumption: "", risk: "medium" as Risk })}
            itemLabel={(a, i) => `assumption ${i + 1}`}
            render={(a, update, i) => (
              <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                <Input
                  aria-label={`Assumption ${i + 1}`}
                  value={a.assumption}
                  aria-invalid={invalid(a.assumption)}
                  onChange={(e) => update({ ...a, assumption: e.target.value })}
                />
                <Select value={a.risk} onValueChange={(r) => update({ ...a, risk: r as Risk })}>
                  <SelectTrigger
                    aria-label={`Risk of assumption ${i + 1}`}
                    className={cn("w-full", a.risk === "high" && "text-destructive")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["high", "medium", "low"] as const).map((r) => (
                      <SelectItem key={r} value={r}>
                        {RISK_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        </Field>

        {value.uncertainties.length > 0 && (
          <Field label="What we weren't sure about">
            <ListEditor
              items={value.uncertainties}
              onChange={(v) => set("uncertainties", v)}
              max={4}
              addLabel="Add note"
              create={() => ""}
              itemLabel={(_, i) => `note ${i + 1}`}
              render={(u, update, i) => (
                <Input
                  aria-label={`Uncertainty ${i + 1}`}
                  value={u}
                  aria-invalid={invalid(u)}
                  onChange={(e) => update(e.target.value)}
                />
              )}
            />
          </Field>
        )}
      </CardContent>
    </Card>
  );
}
