import type { Metadata } from "next";
import { Suspense } from "react";
import { SimulationLoader, SimulationSkeleton } from "@/features/simulations/simulation-loader";

export const metadata: Metadata = { title: "Run simulation" };

export default function SimulatePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<SimulationSkeleton />}>
      <FromParams params={params} />
    </Suspense>
  );
}

async function FromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SimulationLoader experimentId={id} />;
}
