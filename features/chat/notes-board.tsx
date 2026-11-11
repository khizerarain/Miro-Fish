"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SimulatedBadge } from "@/components/simulated-badge";
import { Button } from "@/components/ui/button";
import { deleteResearchNote } from "./actions";
import { SIMULATED_PERSONA_BANNER } from "./constants";
import type { ResearchNoteView } from "./schemas";

export function NotesBoard({
  experimentId,
  initial,
}: {
  experimentId: string;
  initial: ResearchNoteView[];
}) {
  const [notes, setNotes] = useState(initial);

  async function remove(id: string) {
    const res = await deleteResearchNote(id);
    if (!res.ok) return toast.error(res.error);
    setNotes((n) => n.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow-caps">Research notes</p>
          <h1 className="font-display text-title">Pinned quotes</h1>
          <p className="text-muted-foreground">{SIMULATED_PERSONA_BANNER}</p>
          <div className="mt-2">
            <SimulatedBadge />
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/experiments/${experimentId}/results`}>Back to dashboard</Link>
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Pin a quote from a chat or a reaction. Nothing is stored here yet.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">
                {n.personaName ?? "Unknown persona"} · {n.source}
                {n.context ? ` · ${n.context}` : ""}
              </p>
              <blockquote className="mt-2 text-pretty">“{n.quote}”</blockquote>
              <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={() => void remove(n.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
