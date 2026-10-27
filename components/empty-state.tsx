import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2 className="text-subheading font-medium">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-pretty text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
