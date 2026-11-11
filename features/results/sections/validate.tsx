"use client";

import { Panel } from "../panel";
import type { NarrativePayload } from "../schemas";

export function Validate({ narrative }: { narrative: NarrativePayload | null }) {
  return (
    <Panel eyebrow="Validation" title="How to validate this">
      <p className="text-sm text-muted-foreground">
        These questions are prompts for real interviews and surveys. They are not a substitute for talking to customers.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Interview</p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {(narrative?.validation.interviews ?? defaultInterviews).map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Survey</p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {(narrative?.validation.surveys ?? defaultSurveys).map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

const defaultInterviews = [
  "Walk me through the last time this problem wasted an afternoon.",
  "What would have to be true for you to drop the tool you use today?",
  "Where would you expect to see the price?",
];
const defaultSurveys = [
  "At this monthly price, would you call it too cheap, fair, expensive, or not for you?",
  "Which missing piece would change your mind?",
  "Would you mention this to a colleague this month?",
];
