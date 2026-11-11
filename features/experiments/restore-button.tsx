"use client";

import { ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { restoreExperiment } from "./actions";

export function RestoreButton({ experimentId, name }: { experimentId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await restoreExperiment(experimentId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(`“${name}” is back in your experiments`);
          router.refresh();
        })
      }
    >
      <ArchiveRestore /> Restore
    </Button>
  );
}
