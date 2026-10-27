import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardContent, DashboardSkeleton } from "@/features/dashboard/dashboard-content";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
