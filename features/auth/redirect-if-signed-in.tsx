import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/dashboard");
  return null;
}
