"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { discardDraft } from "@/features/ideas/actions";
import { clearLocalDraft } from "@/features/ideas/wizard/local-draft";

export function DiscardButton({ ideaId, name }: { ideaId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Discard ${name}`} className="text-muted-foreground">
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard “{name}”?</DialogTitle>
          <DialogDescription>
            The idea, its inputs, and its analysis will be deleted. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep it</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await discardDraft(ideaId);
                if (!res.ok) return void toast.error(res.error);
                clearLocalDraft(ideaId);
                toast("Draft discarded");
                router.refresh();
              })
            }
          >
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
