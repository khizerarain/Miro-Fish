import type { IdeaInput } from "../schemas";

/** localStorage mirror so a refresh inside the autosave debounce window never loses typing. */
type LocalDraft = { input: IdeaInput; savedAt: number };

const key = (ideaId: string | null) => `mf:idea-draft:${ideaId ?? "new"}`;

export function readLocalDraft(ideaId: string | null): LocalDraft | null {
  try {
    const raw = localStorage.getItem(key(ideaId));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(ideaId: string | null, input: IdeaInput) {
  try {
    localStorage.setItem(key(ideaId), JSON.stringify({ input, savedAt: Date.now() } satisfies LocalDraft));
  } catch {
    // Quota exceeded (large image) or storage disabled: the server copy still exists.
  }
}

export function clearLocalDraft(ideaId: string | null) {
  try {
    localStorage.removeItem(key(ideaId));
  } catch {
    // ignore
  }
}
