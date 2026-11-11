import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DiscardButton } from "./discard-button";
import { ExperimentRowMenu } from "./row-menu";
import type { ExperimentListItem } from "./queries";

const STATUS: Record<NonNullable<ExperimentListItem["ideaStatus"]>, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  analyzing: { label: "Analyzing", className: "bg-muted text-muted-foreground" },
  analyzed: { label: "Review analysis", className: "bg-brand-soft text-brand-soft-foreground" },
  confirmed: { label: "Ready for audience", className: "bg-primary text-primary-foreground" },
};

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function relative(date: Date, now: number) {
  const minutes = Math.round((date.getTime() - now) / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export function ExperimentList({
  items,
  now,
  projects = [],
}: {
  items: ExperimentListItem[];
  now: number;
  projects?: { id: string; name: string }[];
}) {
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {items.map((item) => {
        const run =
          item.runStatus === "simulating" || item.runStatus === "queued"
            ? { label: "Simulating", className: "bg-brand-soft text-brand-soft-foreground" }
            : item.runStatus === "complete" || item.runStatus === "analyzing"
              ? { label: item.runStatus === "analyzing" ? "Analyzing" : "Dashboard", className: "bg-primary text-primary-foreground" }
              : item.runStatus === "cancelled"
                ? { label: "Simulation paused", className: "bg-muted text-muted-foreground" }
                : null;
        const status = run ?? (item.ideaStatus ? STATUS[item.ideaStatus] : STATUS.draft);
        const href =
          item.runStatus === "simulating" || item.runStatus === "queued" || item.runStatus === "cancelled"
            ? `/experiments/${item.id}/simulate`
            : item.runStatus === "complete" || item.runStatus === "analyzing"
              ? `/experiments/${item.id}/results`
              : item.ideaStatus === "confirmed"
              ? `/experiments/${item.id}/audience`
              : item.ideaId
                ? `/experiments/new?draft=${item.ideaId}`
                : "/experiments";
        return (
          <li
            key={item.id}
            className="group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <Link href={href} className="font-medium after:absolute after:inset-0 focus-visible:outline-none">
                {item.name}
              </Link>
              <p className="text-xs text-muted-foreground">Edited {relative(item.updatedAt, now)}</p>
            </div>
            <Badge className={cn("shrink-0 font-normal", status.className)}>{status.label}</Badge>
            {item.ideaId && item.ideaStatus !== "confirmed" && (
              <div className="relative z-10">
                <DiscardButton ideaId={item.ideaId} name={item.name} />
              </div>
            )}
            <ExperimentRowMenu experimentId={item.id} name={item.name} projects={projects} />
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </li>
        );
      })}
    </ul>
  );
}

export function ExperimentListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y rounded-2xl border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
