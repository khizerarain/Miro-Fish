"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Copy, ExternalLink, GitPullRequest, RefreshCw, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { connectEveryoneAudience, disconnectRepo, retryPrRun, setRepoAudience, setRepoToggles } from "./actions";
import { EVERYONE_AUDIENCE_NAME } from "./everyone";
import type { GithubPageData } from "./page-data";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  briefing: { label: "Reading the diff", className: "bg-muted text-muted-foreground" },
  simulating: { label: "Simulating", className: "bg-brand-soft text-brand-soft-foreground" },
  analyzing: { label: "Analyzing", className: "bg-brand-soft text-brand-soft-foreground" },
  complete: { label: "Dashboard ready", className: "bg-primary text-primary-foreground" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  skipped: { label: "Skipped", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

const NONE = "__none__";

export function GithubWorkspace({ data }: { data: GithubPageData }) {
  const { setup, repos, audiences, installations } = data;

  return (
    <div className="space-y-10">
      {setup.configured ? (
        <SetupCard installUrl={setup.installUrl} webhookPath={setup.webhookPath} unsigned={setup.unsigned} />
      ) : (
        <Card className="max-w-3xl border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-base font-semibold">App credentials not set</h2>
            </CardTitle>
            <CardDescription>
              {setup.reason} Until then, webhook deliveries are refused and nothing is posted to GitHub.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The setup steps are in <code className="rounded bg-muted px-1.5 py-0.5">docs/GITHUB_APP.md</code>.
          </CardContent>
        </Card>
      )}

      {installations.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitPullRequest className="size-4" aria-hidden="true" />
              <h2 className="text-base font-semibold">No installation yet</h2>
            </CardTitle>
            <CardDescription>
              Install the app on a repository, then come back here to connect an audience.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <section className="space-y-4">
          <div>
            <h2 className="text-subheading font-medium">Connected repositories</h2>
            <p className="text-sm text-muted-foreground">
              Each repository reviews pull requests with one audience. Changing the audience changes who reacts.
            </p>
          </div>
          {repos.length === 0 ? (
            <p className="text-sm text-muted-foreground">The installation has no repositories selected yet.</p>
          ) : (
            <ul className="space-y-4">
              {repos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} audiences={audiences} everyone={data.everyone} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function SetupCard({ installUrl, webhookPath, unsigned }: { installUrl: string; webhookPath: string; unsigned: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">How it works</h2>
        </CardTitle>
        <CardDescription>
          On a pull request, Miro Fish describes the customer-visible change, has your audience react, and posts a
          clearly labeled summary. It never blocks a merge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Install the app on a repository.</li>
          <li>Generate an audience with personas, then connect it below.</li>
          <li>Open a pull request. A comment appears when the simulation finishes.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <a href={installUrl} target="_blank" rel="noreferrer">
              <GitPullRequest className="size-4" aria-hidden="true" />
              Install on a repository
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(webhookPath);
              setCopied(true);
              toast.success("Webhook URL copied");
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            Webhook URL
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Webhook: <code className="rounded bg-muted px-1.5 py-0.5">{webhookPath}</code> · requires a public URL (use a
          tunnel in development).
        </p>
        {unsigned && (
          <p className="text-xs text-muted-foreground">
            No webhook secret is set, so deliveries aren&apos;t signed. That&apos;s accepted in development only; a
            production server refuses them until <code className="rounded bg-muted px-1.5 py-0.5">GITHUB_WEBHOOK_SECRET</code>{" "}
            is set.
          </p>
        )}
        <div className="flex gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-pretty">
            Comments are labeled <strong>simulated results</strong> and are hypotheses for discussion, not user research.
            Validate anything important with real customers.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type Repo = GithubPageData["repos"][number];
type Audience = GithubPageData["audiences"][number];
type EveryoneOffer = GithubPageData["everyone"];

function RepoCard({ repo, audiences, everyone }: { repo: Repo; audiences: Audience[]; everyone: EveryoneOffer }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const connected = audiences.find((a) => a.id === repo.audienceId);

  const reviewAsEveryone = () => {
    startTransition(async () => {
      const res = await connectEveryoneAudience(repo.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(
          res.generating ? "Connected “Everyone” — generating its personas now" : "Connected the “Everyone” audience",
        );
        router.refresh();
      }
    });
  };

  const setAudience = (value: string) => {
    startTransition(async () => {
      const res = await setRepoAudience(repo.id, value === NONE ? null : value);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(value === NONE ? "Audience disconnected" : "Audience connected");
        router.refresh();
      }
    });
  };

  const toggle = (key: "commentEnabled" | "checkEnabled", value: boolean) => {
    void key;
    void value;
    startTransition(async () => {
      const res = await setRepoToggles(repo.id, {
        commentEnabled: key === "commentEnabled" ? value : repo.commentEnabled,
        checkEnabled: key === "checkEnabled" ? value : repo.checkEnabled,
      });
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  };

  return (
    <li className="rounded-2xl border bg-card">
      <div className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 font-medium">
            <GitPullRequest className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{repo.fullName}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {repo.audienceName ? `Reviews as “${repo.audienceName}”` : "No audience connected — pull requests are skipped"}
            {connected?.status === "generating" && " · personas are still generating"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {connected?.name !== EVERYONE_AUDIENCE_NAME && (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={reviewAsEveryone}>
              <Users className="size-3.5" aria-hidden="true" />
              {everyone.needsGeneration
                ? `Review as everyone · ${everyone.size} people, ${everyone.costLabel}`
                : "Review as everyone"}
            </Button>
          )}
          <Select value={repo.audienceId ?? NONE} onValueChange={setAudience} disabled={pending}>
            <SelectTrigger size="sm" className="w-[220px]">
              <SelectValue placeholder="Choose an audience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No audience</SelectItem>
              {audiences.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} · {a.size.toLocaleString("en-US")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await disconnectRepo(repo.id);
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success("Repository disconnected");
                  router.refresh();
                }
              })
            }
          >
            Disconnect
          </Button>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Post a PR comment
            <span className="block text-xs text-muted-foreground">One comment per PR, updated on new commits.</span>
          </span>
          <Switch
            checked={repo.commentEnabled}
            onCheckedChange={(v) => toggle("commentEnabled", v)}
            aria-label="Post a pull request comment"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Publish a check run
            <span className="block text-xs text-muted-foreground">Always neutral — never blocks a merge.</span>
          </span>
          <Switch
            checked={repo.checkEnabled}
            onCheckedChange={(v) => toggle("checkEnabled", v)}
            aria-label="Publish a check run"
          />
        </label>
      </div>

      {repo.runs.length > 0 && (
        <div className="border-t px-5 py-4">
          <p className="mb-2 text-eyebrow-caps">Recent pull requests</p>
          <ul className="space-y-2">
            {repo.runs.map((run) => (
              <RunRow key={run.id} run={run} repo={repo} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function RunRow({ run, repo }: { run: Repo["runs"][number]; repo: Repo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const style = STATUS_STYLE[run.status] ?? STATUS_STYLE.queued!;
  const inFlight = run.status === "queued" || run.status === "briefing" || run.status === "simulating" || run.status === "analyzing";

  return (
    <li className="flex flex-wrap items-center gap-3 text-sm">
      <Badge className={`${style.className} shrink-0 font-normal`}>{style.label}</Badge>
      <a
        href={run.prUrl}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 truncate hover:underline"
        title={run.prTitle}
      >
        #{run.prNumber} {run.prTitle}
      </a>
      {run.statusDetail && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="max-w-[220px] truncate text-xs text-muted-foreground">{run.statusDetail}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-72 text-pretty">{run.statusDetail}</TooltipContent>
        </Tooltip>
      )}
      {run.experimentId && (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/experiments/${run.experimentId}/results`}>
            Dashboard
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      )}
      {!inFlight && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await retryPrRun(run.id);
              if (!res.ok) toast.error(res.error);
              else toast.success("Re-running this review");
              router.refresh();
            })
          }
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Re-run
        </Button>
      )}
      <span className="sr-only">{repo.fullName}</span>
    </li>
  );
}
