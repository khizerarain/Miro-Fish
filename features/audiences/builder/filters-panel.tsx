"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { INTEREST_OPTIONS, INCOME_BANDS, REGIONS } from "../constants";
import type { AudienceFilters } from "../schemas";

export function FiltersPanel({ value, onChange }: { value: AudienceFilters; onChange: (f: AudienceFilters) => void }) {
  const [profession, setProfession] = useState("");
  const toggle = <K extends "regions" | "incomeBands" | "interests">(key: K, id: AudienceFilters[K][number]) => {
    const list = value[key] as string[];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-subheading font-medium">Filters</h2>
        <p className="text-sm text-muted-foreground">Leave a group empty to allow the full range.</p>
      </div>

      <div className="space-y-3">
        <Label>Age {value.ageMin}–{value.ageMax}</Label>
        <Slider
          min={18}
          max={80}
          step={1}
          value={[value.ageMin, value.ageMax]}
          onValueChange={([a, b]) => onChange({ ...value, ageMin: a ?? 18, ageMax: b ?? 80 })}
        />
      </div>

      <div className="space-y-3">
        <Label>Tech comfort {value.techMin}–{value.techMax} / 5</Label>
        <Slider
          min={1}
          max={5}
          step={1}
          value={[value.techMin, value.techMax]}
          onValueChange={([a, b]) => onChange({ ...value, techMin: a ?? 1, techMax: b ?? 5 })}
        />
      </div>

      <fieldset className="scroll-mt-32 space-y-2">
        <legend className="text-sm font-medium">Region</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {REGIONS.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.regions.includes(r.id)}
                onCheckedChange={() => toggle("regions", r.id)}
                aria-label={r.label}
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Income</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {INCOME_BANDS.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.incomeBands.includes(b.id)}
                onCheckedChange={() => toggle("incomeBands", b.id)}
                aria-label={b.label}
              />
              {b.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Interests</legend>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((id) => {
            const on = value.interests.includes(id);
            return (
              <Button key={id} type="button" size="sm" variant={on ? "default" : "outline"} onClick={() => toggle("interests", id)}>
                {id}
              </Button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="professions">Professions</Label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const p = profession.trim();
            if (!p || value.professions.includes(p)) return;
            onChange({ ...value, professions: [...value.professions, p].slice(0, 12) });
            setProfession("");
          }}
        >
          <Input id="professions" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="e.g. Nurse" />
          <Button type="submit" variant="outline">
            Add
          </Button>
        </form>
        {value.professions.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {value.professions.map((p) => (
              <li key={p}>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onChange({ ...value, professions: value.professions.filter((x) => x !== p) })}
                >
                  {p} <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
