import "server-only";
import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import type { GithubRepo } from "@/db/schema";
import { env } from "@/lib/env";

const API_VERSION = "2022-11-28";
const API_BASE = "https://api.github.com";

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

export type GithubConfig = {
  appId: string;
  privateKey: string;
  /** Null means deliveries aren't signed; the webhook only accepts that outside production. */
  webhookSecret: string | null;
  slug: string | null;
};

/** Returns the GitHub App config, or null when the integration is not set up. */
export function githubConfig(): GithubConfig | null {
  const e = env();
  if (!e.GITHUB_APP_ID || !e.GITHUB_APP_PRIVATE_KEY) return null;
  return {
    appId: e.GITHUB_APP_ID,
    // Env vars are single-line, so PEMs usually arrive with escaped newlines. Depending on how the
    // value was pasted or written, that can be "\n" or "\\n" — normalise both to real newlines.
    privateKey: e.GITHUB_APP_PRIVATE_KEY.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").trim(),
    webhookSecret: e.GITHUB_WEBHOOK_SECRET ?? null,
    slug: e.GITHUB_APP_SLUG?.replace(/^https?:\/\/github\.com\/apps\//, "").replace(/\/+$/, "") || null,
  };
}

export function installUrl(config: GithubConfig) {
  return config.slug ? `https://github.com/apps/${config.slug}/installations/new` : "https://github.com/settings/installations";
}

/** App JWT, valid for 10 minutes (GitHub's maximum is 10). */
async function appJwt(config: GithubConfig): Promise<string> {
  let key;
  try {
    // GitHub hands out PKCS#1 ("BEGIN RSA PRIVATE KEY"); Node reads both that and PKCS#8.
    key = createPrivateKey(config.privateKey);
  } catch (err) {
    throw new GithubError(
      `GITHUB_APP_PRIVATE_KEY could not be read as a PEM private key (${(err as Error).message}). ` +
        `Paste the .pem file's full contents, including the BEGIN/END lines.`,
      0,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 60) // allow for clock drift
    .setExpirationTime(now + 540)
    .setIssuer(config.appId)
    .sign(key);
}

type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<number, CachedToken>();

/** Installation access token (1 hour), cached in-process until ~5 minutes before expiry. */
export async function installationToken(installationId: number, config = githubConfig()): Promise<string> {
  if (!config) throw new GithubError("GitHub App is not configured.", 0);
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 5 * 60_000) return cached.token;

  const jwt = await appJwt(config);
  const res = await fetch(`${API_BASE}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": API_VERSION,
    },
  });
  if (!res.ok) {
    throw new GithubError("Could not mint an installation token.", res.status, await res.text());
  }
  const body = (await res.json()) as { token: string; expires_at: string };
  const expiresAt = new Date(body.expires_at).getTime();
  tokenCache.set(installationId, { token: body.token, expiresAt });
  return body.token;
}

export function forgetInstallationToken(installationId: number) {
  tokenCache.delete(installationId);
}

type ApiOpts = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Return the raw Response instead of parsed JSON (for 204s). */
  raw?: boolean;
};

/** Authenticated call as the installation. Retries once on a 401 with a fresh token. */
export async function githubApi<T>(
  installationId: number,
  path: string,
  opts: ApiOpts = {},
  retried = false,
): Promise<T> {
  const token = await installationToken(installationId);
  const res = await fetch(path.startsWith("http") ? path : `${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": API_VERSION,
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !retried) {
    forgetInstallationToken(installationId);
    return githubApi<T>(installationId, path, opts, true);
  }
  if (!res.ok) {
    throw new GithubError(`GitHub API ${opts.method ?? "GET"} ${path} failed`, res.status, (await res.text()).slice(0, 500));
  }
  if (opts.raw || res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function repository(ref: { installationId: number; fullName: string }) {
  return githubApi<{
    id: number;
    full_name: string;
    default_branch: string;
    private: boolean;
    html_url: string;
  }>(ref.installationId, `/repos/${ref.fullName}`);
}

export type InstallationRepositories = {
  total_count: number;
  repositories: { id: number; full_name: string; default_branch: string; private: boolean }[];
};

export async function installationRepositories(installationId: number): Promise<InstallationRepositories> {
  return githubApi(installationId, `/installation/repositories?per_page=100`);
}

export function repoKey(repo: Pick<GithubRepo, "fullName">) {
  return repo.fullName;
}
