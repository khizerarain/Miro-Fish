import type { Metadata } from "next";
import { Suspense } from "react";
import { ResultsLoader, ResultsSkeleton } from "@/features/results/results-loader";

export const metadata: Metadata = { title: "Research dashboard" };

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <FromParams params={params} />
    </Suspense>
  );
}

async function FromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsLoader experimentId={id} />;
}
