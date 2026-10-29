"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const MESSAGES = [
  "Reading your idea…",
  "Working out who it's for…",
  "Looking for likely alternatives…",
  "Listing the assumptions worth testing…",
];

export function AnalysisSkeleton() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, MESSAGES.length - 1)), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="gap-0 py-0" aria-busy="true">
      <CardHeader className="border-b py-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          {MESSAGES[i]}
        </p>
        <Skeleton className="mt-2 h-7 w-64" />
      </CardHeader>
      <CardContent className="space-y-8 py-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        {[3, 4, 2].map((rows, k) => (
          <div key={k} className="space-y-2">
            <Skeleton className="h-3 w-32" />
            {Array.from({ length: rows }, (_, r) => (
              <Skeleton key={r} className="h-9 w-full" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
