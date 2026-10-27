"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        onClick={() => toast("Draft saved", { description: "Your idea is safe. Pick up anytime." })}
      >
        Default
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.success("Simulation complete", { description: "1,000 reactions stored." })}
      >
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Couldn't fetch that URL", { description: "Paste the page text instead." })}
      >
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.promise(new Promise((r) => setTimeout(r, 1500)), {
            loading: "Generating personas…",
            success: "Population ready",
            error: "Generation failed",
          })
        }
      >
        Promise
      </Button>
    </div>
  );
}
