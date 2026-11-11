"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 px-4 py-16">
      <p className="text-eyebrow-caps">Something broke</p>
      <h1 className="font-display text-title">We couldn&apos;t finish that</h1>
      <p className="text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
