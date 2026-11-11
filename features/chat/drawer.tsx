"use client";

import { useEffect, useRef, useState } from "react";
import { Pin, Send } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { openChat, saveResearchNote, sendChatMessage } from "./actions";
import { CHAT_STARTERS, SIMULATED_PERSONA_BANNER } from "./constants";
import type { ChatMode, ChatThread } from "./schemas";

export type ChatTarget = { personaId: string; variantId?: string | null };

export function ChatDrawer({
  experimentId,
  target,
  onClose,
}: {
  experimentId: string;
  target: ChatTarget | null;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [convince, setConvince] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // Only trust a thread whose persona matches the currently open target.
  const current = target && thread?.personaId === target.personaId ? thread : null;
  const opening = Boolean(target) && !current && !error;

  useEffect(() => {
    if (!target) return;
    let gone = false;
    void openChat(experimentId, target.personaId, target.variantId).then((res) => {
      if (gone) return;
      if (!res.ok) {
        setError(res.error);
        setThread(null);
        return;
      }
      setError(null);
      setThread(res.thread);
    });
    return () => {
      gone = true;
    };
  }, [experimentId, target]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [current?.messages.length, busy]);

  function close() {
    setThread(null);
    setError(null);
    setDraft("");
    setConvince(false);
    onClose();
  }

  async function send(text: string, mode: ChatMode) {
    if (!current || !text.trim() || busy) return;
    setBusy(true);
    const res = await sendChatMessage({
      experimentId: current.experimentId,
      personaId: current.personaId,
      variantId: current.variantId,
      message: text.trim(),
      mode,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setThread(res.thread);
    setDraft("");
  }

  async function pin(quote: string, context: string) {
    if (!current) return;
    const res = await saveResearchNote({
      experimentId: current.experimentId,
      personaId: current.personaId,
      variantId: current.variantId,
      quote,
      context,
      source: "chat",
    });
    if (!res.ok) return toast.error(res.error);
    toast.success("Pinned to research notes");
  }

  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && close()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{current?.personaName ?? "Talk to a customer"}</SheetTitle>
          <SheetDescription>
            {current
              ? `${current.segmentLabel}${current.profession ? ` · ${current.profession}` : ""}`
              : opening
                ? "Loading…"
                : "Simulated persona"}
          </SheetDescription>
        </SheetHeader>
        <Alert className="mx-4 mt-3 border-dashed">
          <AlertDescription>{SIMULATED_PERSONA_BANNER}</AlertDescription>
        </Alert>
        {error && <p className="px-4 pt-3 text-sm text-destructive">{error}</p>}
        {current?.originalImpression && (
          <div className="mx-4 mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Original simulated reaction</p>
            <p className="mt-1 text-pretty">{current.originalImpression}</p>
            {current.originalScore != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Interest {current.originalScore} · intent {current.originalIntent}
              </p>
            )}
          </div>
        )}
        <ScrollArea className="min-h-0 flex-1 px-4 py-3">
          <ul className="space-y-3">
            {current?.messages.map((m) => (
              <li key={m.id} className={m.role === "user" ? "ml-8" : "mr-4"}>
                <div className={`rounded-xl border p-3 text-sm ${m.role === "user" ? "bg-primary/5" : "bg-card"}`}>
                  <p className="text-pretty">{m.content}</p>
                  {m.role === "assistant" && m.updatedScore != null && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Simulated intent after this pitch: {m.updatedIntent} · score {m.updatedScore}
                    </p>
                  )}
                </div>
                {m.role === "assistant" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-xs"
                    onClick={() => void pin(m.content, m.mode === "convince" ? "Convince me" : "Chat")}
                    aria-label="Save quote to research notes"
                  >
                    <Pin /> Save quote
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div ref={bottom} />
        </ScrollArea>
        {current && (
          <div className="space-y-3 border-t p-4">
            <div className="flex flex-wrap gap-2">
              {CHAT_STARTERS.map((s) => (
                <Button key={s.id} type="button" size="sm" variant="outline" disabled={busy} onClick={() => void send(s.text, "chat")}>
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="convince-mode" className="text-sm">
                Convince me
              </Label>
              <Switch id="convince-mode" checked={convince} onCheckedChange={setConvince} aria-label="Convince me mode" />
            </div>
            {convince && (
              <p className="text-xs text-muted-foreground">
                Pitch a change. They will answer in character with an updated simulated intent.
              </p>
            )}
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={convince ? "Pitch a change — price, proof, a feature…" : "Ask them something…"}
              aria-label={convince ? "Your pitch" : "Message"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft, convince ? "convince" : "chat");
                }
              }}
            />
            <Button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => void send(draft, convince ? "convince" : "chat")}
            >
              <Send />
              {busy ? "Waiting…" : convince ? "Pitch" : "Send"}
            </Button>
          </div>
        )}
        {opening && (
          <p className="p-4 text-sm text-muted-foreground" aria-busy="true">
            Opening conversation…
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function TalkButton({
  onClick,
  label = "Talk",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} aria-label={label}>
      {label}
    </Button>
  );
}
