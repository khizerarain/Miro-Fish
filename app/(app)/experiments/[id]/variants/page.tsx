import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { VariantsLoader } from "@/features/variants/loader";

export const metadata: Metadata = { title: "A/B variants" };

export default function VariantsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <FromParams params={params} />
    </Suspense>
  );
}

async function FromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VariantsLoader experimentId={id} />;
}
