"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { applyImprovement, draftImprovement } from "./actions";
import type { ImproveDraft } from "./schemas";

export function ImproveButton({
  experimentId,
  recommendation,
}: {
  experimentId: string;
  recommendation: { title: string; detail: string; evidence: string };
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ImproveDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function start() {
    setOpen(true);
    setBusy(true);
    const res = await draftImprovement(experimentId, recommendation);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      setOpen(false);
      return;
    }
    setDraft(res.draft);
  }

  async function apply(editAudience: boolean) {
    if (!draft) return;
    setBusy(true);
    const res = await applyImprovement(experimentId, draft, { editAudience });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("New run created. This is still a simulated hypothesis.");
    router.push(res.href);
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => void start()}>
        Improve and rerun
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply “{recommendation.title}”</DialogTitle>
            <DialogDescription>
              The model drafted an edit. Approve it to clone this idea into a new run. Simulated results, not a forecast.
            </DialogDescription>
          </DialogHeader>
          {busy && !draft && <p className="text-sm text-muted-foreground">Drafting the edit…</p>}
          {draft && (
            <div className="space-y-3 text-sm">
              <p className="text-pretty text-muted-foreground">{draft.rationale}</p>
              <Field label="Description">
                <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <Field label="Value proposition">
                <Textarea value={draft.valueProposition} onChange={(e) => setDraft({ ...draft, valueProposition: e.target.value })} />
              </Field>
              <Field label="Ad headline">
                <Textarea value={draft.adHeadline} onChange={(e) => setDraft({ ...draft, adHeadline: e.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy || !draft} onClick={() => void apply(true)}>
              Approve, edit audience
            </Button>
            <Button type="button" disabled={busy || !draft} onClick={() => void apply(false)}>
              Approve, same audience
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
