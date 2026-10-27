import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

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
          <CardTitle>Account</CardTitle>
          <CardDescription>Profile editing and usage limits come later.</CardDescription>
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
    </div>
  );
}
