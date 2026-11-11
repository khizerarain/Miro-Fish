"use client";

import { Button } from "@/components/ui/button";
import { saveResearchNote } from "@/features/chat/actions";
import { toast } from "sonner";
import type { DashboardStats } from "../compute";
import { Panel } from "../panel";
import type { NarrativePayload } from "../schemas";

export function Messaging({
  stats,
  narrative,
  experimentId,
  shareMode,
  onTalk,
}: {
  stats: DashboardStats;
  narrative: NarrativePayload | null;
  experimentId: string;
  shareMode?: boolean;
  onTalk?: (personaId: string, variantId: string) => void;
}) {
  return (
    <Panel eyebrow="Messaging" title="What landed vs what bounced">
      <div className="grid gap-6 lg:grid-cols-2">
        <QuoteCol
          title="Resonated"
          notes={narrative?.messaging.resonated ?? []}
          quotes={stats.resonatedQuotes}
          experimentId={experimentId}
          shareMode={shareMode}
          onTalk={onTalk}
        />
        <QuoteCol
          title="Confused or ignored"
          notes={narrative?.messaging.confused ?? []}
          quotes={stats.confusedQuotes}
          experimentId={experimentId}
          shareMode={shareMode}
          onTalk={onTalk}
        />
      </div>
    </Panel>
  );
}

function QuoteCol({
  title,
  notes,
  quotes,
  experimentId,
  shareMode,
  onTalk,
}: {
  title: string;
  notes: string[];
  quotes: { personaId: string; variantId: string; name: string; text: string; score: number }[];
  experimentId: string;
  shareMode?: boolean;
  onTalk?: (personaId: string, variantId: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{title}</p>
      {notes.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <ul className="mt-3 space-y-2">
        {quotes.slice(0, 3).map((q) => (
          <li key={q.personaId + q.score} className="rounded-lg border p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              {q.name} · score {q.score}
            </p>
            <p className="mt-1 text-pretty">{q.text}</p>
            {!shareMode && (
              <div className="mt-2 flex flex-wrap gap-2">
                {onTalk && (
                  <Button type="button" size="sm" variant="outline" onClick={() => onTalk(q.personaId, q.variantId)}>
                    Talk
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const res = await saveResearchNote({
                      experimentId,
                      personaId: q.personaId,
                      variantId: q.variantId,
                      quote: q.text,
                      context: title,
                      source: "reaction",
                    });
                    if (!res.ok) return toast.error(res.error);
                    toast.success("Pinned to research notes");
                  }}
                >
                  Save quote
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
