import { FlaskConical, Loader2, Plus } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/empty-state";
import { SimulatedBadge } from "@/components/simulated-badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToastDemo } from "@/features/design/toast-demo";

export const metadata: Metadata = { title: "Design system" };

const COLORS = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["muted", "bg-muted"],
  ["border", "bg-border"],
  ["muted-foreground", "bg-muted-foreground"],
  ["foreground", "bg-foreground"],
  ["primary (accent)", "bg-primary"],
  ["brand-soft", "bg-brand-soft"],
  ["destructive", "bg-destructive"],
] as const;

const TYPE = [
  ["Display · serif", "font-display text-display", "Simulated customers"],
  ["Title · serif", "font-display text-title", "Experiment results"],
  ["Heading", "text-heading font-medium", "Top objections"],
  ["Subheading", "text-subheading", "How 1,000 personas reacted"],
  ["Body", "text-base", "Each persona evaluates your idea in character."],
  ["Small / muted", "text-sm text-muted-foreground", "Updated 2 minutes ago"],
  ["Eyebrow", "text-eyebrow-caps", "Segment breakdown"],
] as const;

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t py-12 lg:grid-cols-[14rem_1fr]">
      <div className="space-y-1">
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="space-y-3 pb-12">
          <p className="text-eyebrow-caps">Design system</p>
          <h1 className="font-display text-title">Miro Fish components</h1>
          <p className="max-w-2xl text-muted-foreground">
            A calm neutral base, one accent, and a serif for display moments. Toggle the theme to check both modes.
          </p>
        </div>

        <Section
          title="Color"
          description="Semantic tokens only. The accent is reserved for primary actions and key data."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {COLORS.map(([name, cls]) => (
              <div key={name} className="space-y-2">
                <div className={`h-16 rounded-xl border ${cls}`} />
                <p className="font-mono text-xs text-muted-foreground">{name}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography" description="Geist for UI, Instrument Serif for display headings.">
          <div className="space-y-6">
            {TYPE.map(([label, cls, sample]) => (
              <div key={label} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-baseline">
                <p className="font-mono text-xs text-muted-foreground">{label}</p>
                <p className={cls}>{sample}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Radius & elevation">
          <div className="flex flex-wrap gap-6">
            {["rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl"].map((r) => (
              <div key={r} className={`flex size-24 items-end border bg-card p-3 ${r}`}>
                <span className="font-mono text-xs text-muted-foreground">{r.replace("rounded-", "")}</span>
              </div>
            ))}
            <div className="flex size-24 items-end rounded-xl bg-card p-3 shadow-soft">
              <span className="font-mono text-xs text-muted-foreground">soft</span>
            </div>
            <div className="flex size-24 items-end rounded-xl bg-card p-3 shadow-lifted">
              <span className="font-mono text-xs text-muted-foreground">lifted</span>
            </div>
          </div>
        </Section>

        <Section title="Buttons" description="One primary action per screen.">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="destructive">Delete</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">
                <Plus /> Large
              </Button>
              <Button size="icon" variant="outline" aria-label="Add">
                <Plus />
              </Button>
              <Button disabled>
                <Loader2 className="animate-spin" /> Running
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Inputs">
          <div className="grid max-w-xl gap-5">
            <div className="space-y-2">
              <Label htmlFor="d-name">Product name</Label>
              <Input id="d-name" placeholder="e.g. Ledgerly" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-url">Website URL</Label>
              <Input id="d-url" aria-invalid defaultValue="not a url" aria-describedby="d-url-error" />
              <p id="d-url-error" className="text-sm text-destructive">
                Enter a full URL, like https://example.com
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-desc">Describe your idea</Label>
              <Textarea id="d-desc" rows={4} placeholder="Who is it for, what does it do, and what does it cost?" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-size">Audience size</Label>
              <Select defaultValue="1000">
                <SelectTrigger id="d-size" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["100", "500", "1000", "5000"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {Number(v).toLocaleString("en-US")} personas
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="d-switch" defaultChecked />
              <Label htmlFor="d-switch">Include skeptical segment</Label>
            </div>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>High intent</Badge>
            <Badge variant="secondary">Medium</Badge>
            <Badge variant="outline">Low</Badge>
            <Badge variant="destructive">Failed</Badge>
            <Badge className="bg-brand-soft text-brand-soft-foreground">Extrapolated</Badge>
            <SimulatedBadge />
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Simulated interest</CardTitle>
                <CardDescription>Across 1,000 personas, 5 segments</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-display text-display">62</p>
                <p className="text-sm text-muted-foreground">out of 100 · illustrative</p>
              </CardContent>
              <CardFooter>
                <SimulatedBadge />
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Likely objection</CardTitle>
                <CardDescription>Raised by 31% of the simulated audience</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-pretty text-muted-foreground">
                  &ldquo;I don&apos;t see why I&apos;d switch from the free tool I already use.&rdquo;
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  View 312 quotes
                </Button>
              </CardFooter>
            </Card>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="describe" className="max-w-xl">
            <TabsList>
              <TabsTrigger value="describe">Describe it</TabsTrigger>
              <TabsTrigger value="url">Website URL</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
            </TabsList>
            <TabsContent value="describe" className="pt-3 text-sm text-muted-foreground">
              Write a few sentences about the product and who it&apos;s for.
            </TabsContent>
            <TabsContent value="url" className="pt-3 text-sm text-muted-foreground">
              We&apos;ll fetch the page and pull out the text.
            </TabsContent>
            <TabsContent value="pricing" className="pt-3 text-sm text-muted-foreground">
              Add plans, prices, and billing period.
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Dialog">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Run simulation…</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Run simulation on 1,000 personas?</DialogTitle>
                <DialogDescription>
                  Estimated cost $1.40 and about 3 minutes. Results are simulated hypotheses, not market data.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Run simulation</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        <Section title="Toasts">
          <ToastDemo />
        </Section>

        <Section title="Skeletons" description="Anything async shows its shape while loading.">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border p-6">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="flex items-center gap-4 rounded-xl border p-6">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Empty state">
          <EmptyState
            icon={FlaskConical}
            title="No experiments yet"
            description="Every screen gets one clear next step when there's nothing to show."
            action={<Button>Start your first experiment</Button>}
          />
        </Section>
      </main>
    </div>
  );
}
