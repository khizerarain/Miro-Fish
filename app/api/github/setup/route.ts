import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { githubConfig } from "@/lib/github/app";
import { linkInstallationToUser, syncInstallationRepos } from "@/features/github/webhook-handlers";
import { getInstallationByGithubId } from "@/features/github/queries";

/**
 * GitHub redirects here after the user installs the App ("Setup URL" in the App settings).
 * Query: installation_id, setup_action=install|update, state (we pass through "github").
 *
 * The install itself already happened on GitHub's side; the webhook creates the row. This just
 * binds the installation to the Miro Fish account that pressed the button.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationId = Number(url.searchParams.get("installation_id"));
  const e = githubConfig();

  if (!e) return NextResponse.redirect(new URL("/github?error=not_configured", url.origin));
  if (!Number.isFinite(installationId) || installationId <= 0) {
    return NextResponse.redirect(new URL("/github?error=missing_installation", url.origin));
  }

  const user = await getCurrentUser();
  if (!user) {
    // Send them through sign-in and come straight back to this URL.
    const next = new URL("/login", url.origin);
    next.searchParams.set("next", `/api/github/setup?installation_id=${installationId}&setup_action=${url.searchParams.get("setup_action") ?? "install"}`);
    return NextResponse.redirect(next);
  }

  // The webhook may not have landed yet (GitHub does not guarantee ordering). Poll briefly.
  let row = await getInstallationByGithubId(installationId);
  for (let i = 0; i < 6 && !row; i++) {
    await new Promise((r) => setTimeout(r, 500));
    row = await getInstallationByGithubId(installationId);
  }
  if (!row) {
    return NextResponse.redirect(new URL("/github?error=installation_not_found", url.origin));
  }

  await linkInstallationToUser(installationId, user.id);
  await syncInstallationRepos(row.id, installationId);

  return NextResponse.redirect(new URL("/github?installed=1", url.origin));
}
