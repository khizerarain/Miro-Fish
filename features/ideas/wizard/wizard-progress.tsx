import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Submit idea" },
  { label: "Review analysis" },
  { label: "Define audience" },
  { label: "Run simulation" },
];

export function WizardProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label="Experiment setup progress">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {STEPS.map((step, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <li key={step.label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : n}
              </span>
              <span className={cn("text-sm", active ? "font-medium" : "text-muted-foreground")}>
                {step.label}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
              {n < STEPS.length && <span aria-hidden="true" className="mx-1 hidden h-px w-8 bg-border sm:block" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
