"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logIn, signUp } from "./actions";
import type { AuthFormState } from "./schemas";

type Mode = "login" | "signup";

function Field({
  id,
  label,
  error,
  ...props
}: { id: string; label: string; error?: string } & React.ComponentProps<typeof Input>) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} {...props} />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(mode === "login" ? logIn : signUp, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {mode === "signup" && (
        <Field id="name" label="Name" autoComplete="name" defaultValue={state.values?.name} error={fe.name} required />
      )}
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={fe.email}
        required
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        error={fe.password}
        required
      />

      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-soft-foreground">
          {state.notice}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {mode === "login" ? "Log in" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? "New to Miro Fish? " : "Already have an account? "}
        <Link
          href={{ pathname: mode === "login" ? "/signup" : "/login", query: next ? { next } : undefined }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </Link>
      </p>
    </form>
  );
}
