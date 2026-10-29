import type { Metadata } from "next";
import { Suspense } from "react";
import { WizardLoader, WizardSkeleton } from "@/features/ideas/wizard/wizard-loader";

export const metadata: Metadata = { title: "New experiment" };

export default function NewExperimentPage({ searchParams }: PageProps<"/experiments/new">) {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      <WizardLoader searchParams={searchParams} />
    </Suspense>
  );
}
