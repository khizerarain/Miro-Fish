"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-eyebrow-caps">Error</p>
      <h1 className="font-display text-title">This screen failed to load</h1>
      <p className="text-sm text-muted-foreground">{error.message || "Try again, or go back to the dashboard."}</p>
      <div className="flex gap-2">
        <Button type="button" onClick={reset}>
          Retry
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
