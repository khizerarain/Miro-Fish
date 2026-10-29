import type { Metadata } from "next";
import { Suspense } from "react";
import { AudienceLoader, AudienceSkeleton } from "@/features/audiences/audience-loader";

export const metadata: Metadata = { title: "Define audience" };

export default function AudiencePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<AudienceSkeleton />}>
      <AudienceFromParams params={params} />
    </Suspense>
  );
}

async function AudienceFromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AudienceLoader experimentId={id} />;
}
