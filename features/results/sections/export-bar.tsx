"use client";

import { Download, Link2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadCsv, reactionsToCsv } from "../csv";
import type { CompactReaction } from "../schemas";

export function ExportBar({
  rows,
  labels,
  sharePath,
  name,
  shareMode,
}: {
  rows: CompactReaction[];
  labels: Record<string, string>;
  sharePath: string;
  name: string;
  shareMode?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button
        variant="outline"
        onClick={() => {
          downloadCsv(`${slug(name)}-reactions.csv`, reactionsToCsv(rows, labels));
          toast.success("CSV downloaded");
        }}
      >
        <Download /> CSV of reactions
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer /> Export PDF
      </Button>
      {!shareMode && (
        <Button
          variant="outline"
          onClick={async () => {
            const url = `${window.location.origin}${sharePath}`;
            await navigator.clipboard.writeText(url);
            toast.success("Read-only link copied");
          }}
        >
          <Link2 /> Copy share link
        </Button>
      )}
    </div>
  );
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reactions";
}
