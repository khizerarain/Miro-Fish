import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CompareLoader } from "@/features/variants/compare-loader";

export const metadata: Metadata = { title: "Compare variants" };

export default function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <FromParams params={params} />
    </Suspense>
  );
}

async function FromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompareLoader experimentId={id} />;
}
