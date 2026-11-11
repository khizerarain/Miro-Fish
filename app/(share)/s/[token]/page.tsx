import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareLoader } from "@/features/results/share-loader";

export const metadata: Metadata = { title: "Shared results" };

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-12" aria-busy="true" aria-label="Loading shared dashboard">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      }
    >
      <FromParams params={params} />
    </Suspense>
  );
}

async function FromParams({ params }: { params: Promise<{ token: string }> }) {
  // Shared dashboards read the database and render per request, never at build time.
  await connection();
  const { token } = await params;
  return <ShareLoader token={token} />;
}
