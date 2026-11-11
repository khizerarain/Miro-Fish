"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ROWS = [
  ["n", "New experiment"],
  ["g d", "Dashboard"],
  ["g e", "Experiments"],
  ["g p", "Projects"],
  ["g s", "Settings / usage"],
  ["?", "This list"],
];

export function Shortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingG = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;
      // Only treat a bare "g" as a prefix for a couple of seconds.
      const gActive = Date.now() - pendingG.current < 1500;
      const k = e.key.toLowerCase();
      if (k === "?") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (gActive) {
        pendingG.current = 0;
        const route = ({ d: "/dashboard", e: "/experiments", p: "/projects", s: "/settings" } as const)[
          k as "d" | "e" | "p" | "s"
        ];
        if (route) {
          e.preventDefault();
          router.push(route);
          return;
        }
      }
      if (k === "g") {
        pendingG.current = Date.now();
        return;
      }
      if (k === "n") {
        if (document.activeElement && (document.activeElement as HTMLElement).closest("a,button")) return;
        router.push("/experiments/new");
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {ROWS.map(([key, label]) => (
            <li key={key} className="flex justify-between gap-4">
              <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">{key}</kbd>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
