import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-card";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <AuthCard
      mode="signup"
      title="Create your lab"
      description="Test ideas on simulated customers before you spend on the real thing."
    />
  );
}
