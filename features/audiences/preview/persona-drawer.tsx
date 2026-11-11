"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PersonaProfile } from "../schemas";

export function PersonaDrawer({
  persona,
  segmentLabel,
  onClose,
  onTalk,
}: {
  persona: PersonaProfile | null;
  segmentLabel: string;
  onClose: () => void;
  onTalk?: () => void;
}) {
  return (
    <Sheet open={!!persona} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {persona && (
          <>
            <SheetHeader>
              <SheetTitle>{persona.name}</SheetTitle>
              <SheetDescription>
                {persona.age} · {persona.gender} · {persona.location}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-8">
              <Badge variant="secondary">{segmentLabel}</Badge>
              <p className="text-sm text-pretty">{persona.backstory}</p>
              <Field label="Profession" value={persona.profession} />
              <Field label="Financial situation" value={persona.financialSituation} />
              <Field label="Buying" value={`${persona.buyingBehavior.style} · ${persona.buyingBehavior.priceSensitivity} price sensitivity`} />
              <Field label="Tech comfort" value={`${persona.techComfort} / 5`} />
              <List label="Personality" items={persona.personalityTraits} />
              <List label="Interests" items={persona.interests} />
              <List label="Needs" items={persona.needs} />
              <List label="Pain points" items={persona.painPoints} />
              <List label="Uses today" items={persona.currentAlternatives} />
              {onTalk && (
                <Button type="button" onClick={onTalk}>
                  Talk
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-eyebrow-caps">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-eyebrow-caps">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
