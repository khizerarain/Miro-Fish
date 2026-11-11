"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { archiveExperiment, duplicateExperiment, renameExperiment } from "./actions";
import { assignExperimentProject } from "@/features/projects/actions";

export function ExperimentRowMenu({
  experimentId,
  name,
  projects,
}: {
  experimentId: string;
  name: string;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [renameOpen, setRenameOpen] = useState(false);
  const [nextName, setNextName] = useState(name);

  return (
    <div className="relative z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const res = await duplicateExperiment(experimentId);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Duplicated. Personas copied; run a new simulation when ready.");
                router.push(`/experiments/${res.experimentId}/audience`);
              })
            }
          >
            Duplicate
          </DropdownMenuItem>
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() =>
                start(async () => {
                  const res = await assignExperimentProject(experimentId, p.id);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success(`Moved to ${p.name}`);
                  router.refresh();
                })
              }
            >
              Move to {p.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const res = await archiveExperiment(experimentId);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast("Archived");
                router.refresh();
              })
            }
          >
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename experiment</DialogTitle>
          </DialogHeader>
          <Input value={nextName} onChange={(e) => setNextName(e.target.value)} aria-label="Experiment name" />
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await renameExperiment(experimentId, nextName);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  setRenameOpen(false);
                  router.refresh();
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
