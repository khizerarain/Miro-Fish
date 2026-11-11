import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { loadNotesBoard } from "./actions";
import { NotesBoard } from "./notes-board";

export async function NotesLoader({ experimentId }: { experimentId: string }) {
  const res = await loadNotesBoard(experimentId);
  if (!res.ok) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="We couldn't open notes"
        description={res.error}
        action={
          <Button asChild>
            <Link href="/experiments">Back to experiments</Link>
          </Button>
        }
      />
    );
  }
  return <NotesBoard experimentId={experimentId} initial={res.notes} />;
}
