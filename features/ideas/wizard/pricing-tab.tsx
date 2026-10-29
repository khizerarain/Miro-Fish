"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BILLING_PERIODS, LIMITS, type Plan, PRICING_MODELS, type Pricing } from "../schemas";

const MODEL_LABELS: Record<Pricing["model"], string> = {
  subscription: "Subscription",
  one_time: "One-time purchase",
  freemium: "Freemium",
  usage_based: "Usage-based",
  free: "Free",
};
const PERIOD_LABELS: Record<Plan["period"], string> = {
  month: "per month",
  year: "per year",
  one_time: "one-time",
  usage: "per unit",
};
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY"];

const newPlan = (period: Plan["period"]): Plan => ({ name: "", price: null, period, features: "" });

export function PricingTab({ value, onChange }: { value: Pricing; onChange: (p: Pricing) => void }) {
  const set = (patch: Partial<Pricing>) => onChange({ ...value, ...patch });
  const setPlan = (i: number, patch: Partial<Plan>) =>
    set({ plans: value.plans.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const defaultPeriod: Plan["period"] =
    value.model === "one_time" ? "one_time" : value.model === "usage_based" ? "usage" : "month";

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pricing-model">Pricing model</Label>
          <Select value={value.model} onValueChange={(v) => set({ model: v as Pricing["model"] })}>
            <SelectTrigger id="pricing-model" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICING_MODELS.map((m) => (
                <SelectItem key={m} value={m}>
                  {MODEL_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {value.model !== "free" && (
          <div className="space-y-2">
            <Label htmlFor="pricing-currency">Currency</Label>
            <Select value={value.currency} onValueChange={(v) => set({ currency: v })}>
              <SelectTrigger id="pricing-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {value.model !== "free" && (
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-medium">Plans</p>
              <p className="text-xs text-muted-foreground">
                Add up to {LIMITS.plans}. Leave the price empty if you haven&apos;t decided.
              </p>
            </div>
          </div>

          {value.plans.length === 0 && (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No plans yet. Add one to test how people react to your price.
            </p>
          )}

          <ul className="space-y-4">
            {value.plans.map((plan, i) => (
              <li key={i} className="space-y-4 rounded-xl border bg-card p-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_8rem_9rem_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`plan-${i}-name`}>Plan name</Label>
                    <Input
                      id={`plan-${i}-name`}
                      value={plan.name}
                      maxLength={60}
                      placeholder={i === 0 ? "e.g. Starter" : "e.g. Pro"}
                      onChange={(e) => setPlan(i, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`plan-${i}-price`}>Price ({value.currency})</Label>
                    <Input
                      id={`plan-${i}-price`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={plan.price ?? ""}
                      placeholder="0"
                      onChange={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        setPlan(i, { price: n === null || Number.isNaN(n) ? null : Math.max(0, n) });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`plan-${i}-period`}>Billing</Label>
                    <Select value={plan.period} onValueChange={(v) => setPlan(i, { period: v as Plan["period"] })}>
                      <SelectTrigger id={`plan-${i}-period`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_PERIODS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PERIOD_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${plan.name || `plan ${i + 1}`}`}
                    onClick={() => set({ plans: value.plans.filter((_, idx) => idx !== i) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`plan-${i}-features`}>What&apos;s included</Label>
                  <Input
                    id={`plan-${i}-features`}
                    value={plan.features}
                    maxLength={LIMITS.planFeatures}
                    placeholder="e.g. Unlimited invoices, 3 clients, email support"
                    onChange={(e) => setPlan(i, { features: e.target.value })}
                  />
                </div>
              </li>
            ))}
          </ul>

          {value.plans.length < LIMITS.plans && (
            <Button
              type="button"
              variant="outline"
              onClick={() => set({ plans: [...value.plans, newPlan(defaultPeriod)] })}
            >
              <Plus /> Add plan
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="pricing-notes">Pricing notes (optional)</Label>
        <Textarea
          id="pricing-notes"
          rows={3}
          maxLength={600}
          value={value.notes}
          placeholder="e.g. 14-day free trial, 20% off annual, student discount"
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
