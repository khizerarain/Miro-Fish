"use client";

import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Generic add/remove list used by the analysis card. */
export function ListEditor<T>({
  items,
  onChange,
  render,
  create,
  max,
  min = 0,
  addLabel,
  itemLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, update: (next: T) => void, index: number) => ReactNode;
  create: () => T;
  max: number;
  min?: number;
  addLabel: string;
  itemLabel: (item: T, index: number) => string;
}) {
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {render(item, (next) => onChange(items.map((it, j) => (j === i ? next : it))), i)}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              disabled={items.length <= min}
              aria-label={`Remove ${itemLabel(item, i)}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      {items.length < max && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onChange([...items, create()])}
        >
          <Plus /> {addLabel}
        </Button>
      )}
    </div>
  );
}
