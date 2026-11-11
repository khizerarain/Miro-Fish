"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const KEY = "mf-tour-v1";
const STEPS = [
  {
    title: "Submit an idea",
    body: "Describe the product, paste a URL, or drop in ad copy. Analysis is a hypothesis, not research.",
  },
  {
    title: "Simulate customers",
    body: "Generate personas, run reactions, then talk to anyone in the dashboard. Every number is counted from stored scores.",
  },
  {
    title: "Improve and compare",
    body: "Apply a recommendation, rerun, and compare on the project timeline. Import real notes to reality-check — still not proof.",
  },
];

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function hasSeenTour() {
  return Boolean(window.localStorage.getItem(KEY));
}

export function OnboardingTour() {
  const seen = useSyncExternalStore(subscribe, hasSeenTour, () => true);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (seen || dismissed || !STEPS[step]) return null;
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;

  function finish() {
    window.localStorage.setItem(KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="w-full max-w-md rounded-xl border bg-background p-5 shadow-lg">
        <p className="text-eyebrow-caps">
          Tour {step + 1} / {STEPS.length}
        </p>
        <h2 id="tour-title" className="text-subheading font-medium">
          {s.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
        <p className="mt-2 text-xs text-muted-foreground">Press ? anytime for keyboard shortcuts.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={finish}>
            Skip
          </Button>
          <Button type="button" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? "Start" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
