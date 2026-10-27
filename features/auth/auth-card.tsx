import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthForm } from "./auth-form";

function FormSkeleton({ fields }: { fields: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function AuthCard({
  mode,
  title,
  description,
}: {
  mode: "login" | "signup";
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-title">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Suspense fallback={<FormSkeleton fields={mode === "signup" ? 3 : 2} />}>
        <AuthForm mode={mode} />
      </Suspense>
    </div>
  );
}
