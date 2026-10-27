import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-card";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return <AuthCard mode="login" title="Welcome back" description="Log in to your research lab." />;
}
