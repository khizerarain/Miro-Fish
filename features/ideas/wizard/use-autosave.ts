"use client";

import { useEffect, useState } from "react";
import { saveDraft } from "../actions";
import type { IdeaInput } from "../schemas";
import { clearLocalDraft, writeLocalDraft } from "./local-draft";

export type SaveState = { status: "idle" | "pending" | "saving" | "saved" | "error"; savedAt?: number; error?: string };

const DEBOUNCE_MS = 700;
const RETRY_MS = 4000;

const isBlank = (i: IdeaInput) =>
  !i.title.trim() &&
  !i.description.trim() &&
  !i.url.trim() &&
  !i.urlExtract.trim() &&
  !i.adHeadline.trim() &&
  !i.adCopy.trim() &&
  !i.adImageUrl &&
  i.pricing.plans.length === 0 &&
  !i.pricing.notes.trim();

/** Serializes saves: at most one in flight, latest input always wins. */
function createSaver(initialId: string | null, onId: (id: string) => void, onState: (s: SaveState) => void) {
  let id = initialId;
  let latest: IdeaInput | null = null;
  let dirty = false;
  let inFlight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (ms = DEBOUNCE_MS) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, ms);
  };

  async function run(): Promise<void> {
    if (inFlight) await inFlight;
    if (!dirty || !latest) return;
    dirty = false;
    const snapshot = latest;
    onState({ status: "saving" });

    inFlight = (async () => {
      const res = await saveDraft(id, snapshot).catch(() => ({ ok: false as const, error: "Network error" }));
      if (!res.ok) {
        dirty = true;
        onState({ status: "error", error: res.error });
        schedule(RETRY_MS);
        return;
      }
      if (!id) {
        id = res.ideaId;
        onId(res.ideaId);
        clearLocalDraft(null);
        writeLocalDraft(res.ideaId, snapshot);
        const url = new URL(window.location.href);
        url.searchParams.set("draft", res.ideaId);
        window.history.replaceState(null, "", url);
      }
      onState(dirty ? { status: "pending" } : { status: "saved", savedAt: res.savedAt });
    })();
    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
  }

  return {
    change(input: IdeaInput) {
      latest = input;
      if (!id && isBlank(input)) return;
      writeLocalDraft(id, input);
      dirty = true;
      onState({ status: "pending" });
      schedule();
    },
    /** Saves now (creating the draft if needed) and resolves to the draft id. */
    async flush(input: IdeaInput): Promise<string | null> {
      if (timer) clearTimeout(timer);
      timer = null;
      latest = input;
      if (!id) dirty = true;
      await run();
      return dirty ? null : id;
    },
    /** Saves anything still waiting on the debounce right away, e.g. when leaving the page. */
    flushPending() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      void run();
    },
  };
}

/**
 * Debounced server autosave with a localStorage mirror. Creates the draft on the first
 * non-empty change and writes `?draft=<id>` into the URL so a refresh reloads it.
 */
export function useAutosave(initialId: string | null) {
  const [ideaId, setIdeaId] = useState(initialId);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [saver] = useState(() => createSaver(initialId, setIdeaId, setState));

  // No beforeunload prompt: the localStorage mirror already covers a refresh mid-save.
  useEffect(() => () => saver.flushPending(), [saver]);

  return { ideaId, state, change: saver.change, flush: saver.flush };
}
