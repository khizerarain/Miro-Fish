"use client";

import { ClipboardPaste, Globe, Loader2, RotateCcw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchUrl } from "../actions";
import { LIMITS } from "../schemas";

type Props = {
  url: string;
  extract: string;
  onChange: (patch: { url?: string; urlExtract?: string }) => void;
};

export function UrlTab({ url, extract, onChange }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const showText = extract.length > 0 || manual;

  function read() {
    setError(null);
    startTransition(async () => {
      const res = await fetchUrl(url).catch(() => null);
      if (!res) {
        setError("Something went wrong on our side.");
        return;
      }
      if (res.ok) {
        setPageTitle(res.title || null);
        setManual(false);
        onChange({ url: res.url, urlExtract: res.text });
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) read();
        }}
      >
        <Label htmlFor="idea-url">Website or landing page</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Globe
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="idea-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yourproduct.com"
              value={url}
              onChange={(e) => onChange({ url: e.target.value })}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!url.trim() || pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {pending ? "Reading page…" : extract ? "Read again" : "Read page"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          We fetch the page once and pull out its text. Nothing else is stored.
        </p>
      </form>

      {error && (
        <Alert>
          <AlertTitle>We couldn&apos;t read that page</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setManual(true);
                  setError(null);
                }}
              >
                <ClipboardPaste /> Paste the text instead
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={read} disabled={pending}>
                <RotateCcw /> Try again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!showText && !error && (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          No website yet? Paste your page copy instead.
        </button>
      )}

      {showText && (
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <Label htmlFor="idea-url-text">{manual && !pageTitle ? "Page text" : "Here's what we read"}</Label>
              <p className="text-xs text-muted-foreground">
                {pageTitle ? `From “${pageTitle}”. ` : ""}Edit anything that isn&apos;t about your product.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange({ urlExtract: "" });
                setManual(false);
                setPageTitle(null);
              }}
            >
              <X /> Clear
            </Button>
          </div>
          <Textarea
            id="idea-url-text"
            value={extract}
            onChange={(e) => onChange({ urlExtract: e.target.value })}
            rows={12}
            maxLength={LIMITS.urlExtract}
            placeholder="Paste the headline, description, and feature copy from your page."
            className="min-h-64 resize-y font-mono text-xs leading-relaxed"
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">
            {extract.length.toLocaleString("en-US")} / {LIMITS.urlExtract.toLocaleString("en-US")}
          </p>
        </div>
      )}
    </div>
  );
}
