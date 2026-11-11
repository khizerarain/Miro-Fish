"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { removeVariant, runVariant, saveVariant } from "./actions";
import type { VariantCard, VariantForm } from "./schemas";

export function VariantEditor({
  experimentId,
  variant,
  onChanged,
}: {
  experimentId: string;
  variant: VariantCard;
  onChanged: () => void;
}) {
  const [form, setForm] = useState<VariantForm>(variant.content);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function set<K extends keyof VariantForm>(key: K, value: VariantForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    const res = await saveVariant(variant.id, form);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Saved ${variant.label}`);
    onChanged();
  }

  async function run() {
    setBusy(true);
    const saved = await saveVariant(variant.id, form);
    if (!saved.ok) {
      setBusy(false);
      return toast.error(saved.error);
    }
    const res = await runVariant(experimentId, variant.id);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    router.push(`/experiments/${experimentId}/simulate`);
    router.refresh();
  }

  async function remove() {
    if (variant.isControl) return;
    setBusy(true);
    const res = await removeVariant(variant.id);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    onChanged();
  }

  return (
    <article className="space-y-4 rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-eyebrow-caps">{variant.isControl ? "Control" : "Variant"}</p>
          <h2 className="text-subheading font-medium">{variant.label}</h2>
          <p className="text-xs text-muted-foreground">
            {variant.reactionCount.toLocaleString("en-US")} stored reactions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void save()}>
            Save copy
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void run()} aria-label={`Run ${variant.label} on same personas`}>
            Run on same personas
          </Button>
          {!variant.isControl && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
              Delete
            </Button>
          )}
        </div>
      </div>
      <Field label="Value proposition">
        <Textarea value={form.valueProposition} onChange={(e) => set("valueProposition", e.target.value)} />
      </Field>
      <Field label="Description / landing summary">
        <Textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} />
      </Field>
      <Field label="Ad headline">
        <Input value={form.adHeadline} onChange={(e) => set("adHeadline", e.target.value)} />
      </Field>
      <Field label="Ad copy">
        <Textarea value={form.adCopy} onChange={(e) => set("adCopy", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Listed price">
          <Input
            type="number"
            min={0}
            step="1"
            value={form.listedPrice ?? ""}
            onChange={(e) => set("listedPrice", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
        <Field label="Currency">
          <Input value={form.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
        </Field>
      </div>
      <Field label="Pricing summary">
        <Textarea value={form.pricingSummary} onChange={(e) => set("pricingSummary", e.target.value)} />
      </Field>
      <Field label="Key features (one per line)">
        <Textarea value={form.keyFeaturesText} onChange={(e) => set("keyFeaturesText", e.target.value)} />
      </Field>
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="flex flex-col items-stretch gap-1.5 font-normal">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </Label>
  );
}
