import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { SaveState } from "./use-autosave";

export function SaveIndicator({ state }: { state: SaveState }) {
  const content = {
    idle: null,
    pending: <span className="text-muted-foreground">Unsaved changes</span>,
    saving: (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Saving…
      </span>
    ),
    saved: (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Check className="size-3.5 text-primary" aria-hidden="true" /> Draft saved
      </span>
    ),
    error: (
      <span className="flex items-center gap-1.5 text-destructive">
        <AlertCircle className="size-3.5" aria-hidden="true" /> {state.error ?? "Couldn't save"}. Retrying…
      </span>
    ),
  }[state.status];

  return (
    <p className="min-h-5 text-xs" role="status" aria-live="polite">
      {content}
    </p>
  );
}
