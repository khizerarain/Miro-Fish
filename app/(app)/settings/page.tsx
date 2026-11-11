import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { usageSnapshot } from "@/lib/usage";

export const metadata: Metadata = { title: "Settings" };

async function AccountDetails() {
  const user = await requireUser();
  const e = env();
  const rows = [
    ["Name", user.name ?? "Not set"],
    ["Email", user.email],
    ["Sign-in method", e.AUTH_PROVIDER === "supabase" ? "Supabase" : "Local (development)"],
    ["AI mode", e.MOCK_LLM ? "Mock data (no API credits used)" : `Live (${e.LLM_MODEL})`],
  ];
  return (
    <dl className="divide-y">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-sm sm:col-span-2">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Settings" title="Settings" description="Your account and workspace configuration." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Account</h2>
          </CardTitle>
          <CardDescription>Local or Supabase sign-in. Usage caps apply per account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="space-y-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            }
          >
            <AccountDetails />
          </Suspense>
        </CardContent>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Usage limits</h2>
          </CardTitle>
          <CardDescription>Soft caps so a runaway loop cannot burn credits. Archive experiments to free slots.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <UsageDetails />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function UsageDetails() {
  const user = await requireUser();
  const u = await usageSnapshot(user.id);
  const rows = [
    ["Active experiments", `${u.activeExperiments} / ${u.experimentCap}`],
    ["Jobs in the last 24h", `${u.jobsToday} / ${u.jobsPerDayCap}`],
    ["Logged input tokens", u.inputTokens.toLocaleString("en-US")],
    ["Logged output tokens", u.outputTokens.toLocaleString("en-US")],
    ["Recorded simulation cost", u.actualCostCents === 0 ? "None (mock or unused)" : `$${(u.actualCostCents / 100).toFixed(2)}`],
  ];
  return (
    <dl className="divide-y">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-sm sm:col-span-2">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
