"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AD_CHANNELS, type IdeaInput, LIMITS } from "../schemas";

const CHANNEL_LABELS: Record<(typeof AD_CHANNELS)[number], string> = {
  search: "Search ads",
  social: "Social media",
  display: "Display / banner",
  email: "Email",
  video: "Video",
  print: "Print / outdoor",
  other: "Other",
};

const MAX_DIMENSION = 1280;
const MAX_FILE_BYTES = 10_000_000;

/** Downscales in the browser so the stored data URL stays small. */
async function toCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= LIMITS.adImageBytes) return url;
  }
  throw new Error("Image is too detailed to store. Try a smaller one.");
}

type Patch = Partial<Pick<IdeaInput, "adHeadline" | "adCopy" | "adChannel" | "adImageUrl">>;

export function AdTab({ value, onChange }: { value: IdeaInput; onChange: (patch: Patch) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function onFile(file: File | undefined) {
    setImageError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setImageError("Use a PNG, JPG, or WebP image.");
    if (file.size > MAX_FILE_BYTES) return setImageError("Images must be under 10 MB.");
    setProcessing(true);
    try {
      onChange({ adImageUrl: await toCompressedDataUrl(file) });
    } catch (e) {
      setImageError((e as Error).message || "Couldn't read that image.");
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="ad-headline">Headline</Label>
          <Input
            id="ad-headline"
            value={value.adHeadline}
            maxLength={LIMITS.adHeadline}
            placeholder="e.g. Get paid twice as fast, without the awkward follow-ups"
            onChange={(e) => onChange({ adHeadline: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ad-copy">Ad or campaign copy</Label>
          <Textarea
            id="ad-copy"
            rows={6}
            maxLength={LIMITS.adCopy}
            value={value.adCopy}
            placeholder="Paste the body copy, call to action, or campaign message you want to test."
            onChange={(e) => onChange({ adCopy: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ad-channel">Where it will run</Label>
          <Select
            value={value.adChannel ?? ""}
            onValueChange={(v) => onChange({ adChannel: v as NonNullable<IdeaInput["adChannel"]> })}
          >
            <SelectTrigger id="ad-channel" className="w-full sm:w-64">
              <SelectValue placeholder="Choose a channel" />
            </SelectTrigger>
            <SelectContent>
              {AD_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ad-image">Creative (optional)</Label>
        {value.adImageUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
            <img src={value.adImageUrl} alt="Ad creative preview" className="w-full rounded-xl border object-contain" />
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ adImageUrl: null })}>
              <Trash2 /> Remove image
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={processing}
            className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ImagePlus className="size-5" aria-hidden="true" />
            {processing ? "Processing…" : "Upload an image"}
            <span className="text-xs">PNG, JPG, or WebP</span>
          </button>
        )}
        <input
          ref={fileRef}
          id="ad-image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {imageError && (
          <p role="alert" className="text-sm text-destructive">
            {imageError}
          </p>
        )}
      </div>
    </div>
  );
}
