"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Button } from "@/components/ui/button";
import { createVariant, loadVariants } from "./actions";
import { VariantEditor } from "./editor";
import { MAX_VARIANTS } from "./schemas";
import type { VariantCard } from "./schemas";

export function VariantsWorkspace({
  experimentId,
  seed,
  initial,
}: {
  experimentId: string;
  seed: number;
  initial: VariantCard[];
}) {
  const [variants, setVariants] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const res = await loadVariants(experimentId);
    if (res.ok) setVariants(res.variants);
  }

  async function add() {
    setBusy(true);
    const res = await createVariant(experimentId);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    await reload();
  }

  const ready = variants.filter((v) => v.reactionCount > 0).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow-caps">Comparative experiment</p>
          <h1 className="font-display text-title">A/B/C variants</h1>
          <p className="text-muted-foreground">
            Same personas and seed {seed}. Only the copy, ad, description, pricing, or value proposition changes.
          </p>
          <div className="mt-2">
            <SimulatedBadge />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || variants.length >= MAX_VARIANTS} onClick={() => void add()}>
            Add variant
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/experiments/${experimentId}/compare`}>Compare</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/experiments/${experimentId}/results`}>Dashboard</Link>
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Running a variant replaces that variant&apos;s reactions only. Control stays. {ready} variant
        {ready === 1 ? "" : "s"} have stored reactions.
      </p>
      <div className="space-y-6">
        {variants.map((v) => (
          <VariantEditor key={v.id} experimentId={experimentId} variant={v} onChanged={() => void reload()} />
        ))}
      </div>
    </div>
  );
}
