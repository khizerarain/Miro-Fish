import { after } from "next/server";
import { NextResponse } from "next/server";
import { githubConfig } from "@/lib/github/app";
import { verifyWebhookSignature } from "@/lib/github/signature";
import { parseWebhook } from "@/lib/github/webhooks";
import { advancePrRun } from "@/features/github/pipeline";
import {
  enqueuePullRequest,
  handleInstallation,
  handleInstallationRepositories,
  recordDelivery,
} from "@/features/github/webhook-handlers";

/**
 * GitHub App webhook endpoint. Public by design: the signature IS the authentication.
 *
 * Rules, in order:
 *  1. Read the RAW body — parsing first breaks the HMAC.
 *  2. Verify X-Hub-Signature-256 with a timing-safe compare.
 *  3. Deduplicate by X-GitHub-Delivery (GitHub retries failed deliveries).
 *  4. Acknowledge fast; do the slow work in `after()`.
 */
export async function POST(request: Request) {
  const config = githubConfig();
  if (!config) {
    // 503 rather than 500: the endpoint exists but the App is not configured on this deployment.
    return NextResponse.json({ error: "GitHub App is not configured." }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, signature, config.webhookSecret)) {
    console.warn(JSON.stringify({ evt: "github", step: "webhook", ok: false, reason: "bad_signature" }));
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") ?? "";
  const deliveryId = request.headers.get("x-github-delivery") ?? "";
  if (!deliveryId) return NextResponse.json({ error: "Missing delivery id." }, { status: 400 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }

  const parsed = parseWebhook(event, body);
  const action = typeof (body as { action?: unknown }).action === "string" ? (body as { action: string }).action : null;
  const subject = subjectOf(event, body);

  const fresh = await recordDelivery({ deliveryId, event, action, subject });
  if (!fresh) {
    // Already handled. 200 so GitHub stops retrying.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  console.info(JSON.stringify({ evt: "github", step: "webhook", event, action, subject, ok: true }));

  if (parsed.kind === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  after(async () => {
    try {
      if (parsed.kind === "installation") {
        await handleInstallation(parsed.payload);
        return;
      }
      if (parsed.kind === "installation_repositories") {
        await handleInstallationRepositories(parsed.payload);
        return;
      }
      if (parsed.kind === "pull_request") {
        const res = await enqueuePullRequest(parsed.payload);
        if (res.ignored) {
          console.info(JSON.stringify({ evt: "github", step: "pull_request", ignored: res.ignored, subject }));
          return;
        }
        // Long simulations are carried forward by the pipeline's own resume timer.
        await advancePrRun(res.runId);
      }
    } catch (err) {
      console.error(
        JSON.stringify({ evt: "github", step: "handle", ok: false, event, subject, error: (err as Error).message }),
      );
    }
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}

function subjectOf(event: string, body: unknown): string | null {
  const b = body as {
    repository?: { full_name?: string };
    pull_request?: { number?: number };
    installation?: { account?: { login?: string } };
  };
  if (b.repository?.full_name && b.pull_request?.number != null) {
    return `${b.repository.full_name}#${b.pull_request.number}`;
  }
  if (b.repository?.full_name) return b.repository.full_name;
  if (b.installation?.account?.login) return b.installation.account.login;
  return event ? `${event}` : null;
}
