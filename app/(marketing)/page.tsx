import { ArrowRight, BarChart3, Check, Lightbulb, MessagesSquare, Users, X } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { ReactionPreview } from "@/features/marketing/reaction-preview";

const STEPS = [
  {
    icon: Lightbulb,
    title: "Submit your idea",
    body: "Describe it, paste a landing page, or add pricing and ad copy. We pull out the value proposition and the assumptions worth testing.",
  },
  {
    icon: Users,
    title: "Define your audience",
    body: "Pick segments and filters. We generate a diverse, reproducible population of customer personas.",
  },
  {
    icon: MessagesSquare,
    title: "Run the simulation",
    body: "Each persona reacts in character: interest, objections, price sensitivity, and what would change their mind.",
  },
  {
    icon: BarChart3,
    title: "Analyze and improve",
    body: "Explore segments, objections, and pricing. Apply a recommendation, rerun, and watch what moves.",
  },
];

const GOOD_FOR = [
  "Spotting likely objections before you write a line of code",
  "Comparing positioning, copy, or pricing variants side by side",
  "Deciding which assumptions to test first with real people",
];
const NOT_FOR = [
  "Predicting conversion rates or revenue",
  "Replacing interviews, surveys, or real launch data",
  "Proving that anyone will buy",
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-16 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
        <FadeIn className="space-y-8">
          <p className="text-eyebrow-caps">Virtual customer research</p>
          <h1 className="font-display text-5xl text-balance sm:text-display">
            Test your idea on thousands of virtual customers <em className="text-primary">before</em> you launch
          </h1>
          <p className="max-w-xl text-subheading text-pretty text-muted-foreground">
            Miro Fish builds a population of AI customer personas, shows them your product, and turns their reactions
            into a research dashboard. Find the objections early and test fixes in minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Run your first experiment <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <ReactionPreview />
        </FadeIn>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <FadeIn className="max-w-2xl space-y-3">
            <p className="text-eyebrow-caps">How it works</p>
            <h2 className="font-display text-title text-balance">
              From rough idea to sharper hypothesis in four steps
            </h2>
          </FadeIn>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <FadeIn delay={i * 0.06} className="h-full rounded-2xl border bg-card p-6 shadow-soft">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
                      <step.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 font-medium">{step.title}</h3>
                  <p className="mt-2 text-sm text-pretty text-muted-foreground">{step.body}</p>
                </FadeIn>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="honesty" className="scroll-mt-20 border-t">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.2fr] lg:py-24">
          <FadeIn className="space-y-4">
            <p className="text-eyebrow-caps">Simulated, not verified</p>
            <h2 className="font-display text-title text-balance">A fast first read, not the final word</h2>
            <p className="text-pretty text-muted-foreground">
              Every result in Miro Fish comes from AI personas. They&apos;re prompted to be skeptical, and plenty of
              them will ignore or reject your idea, but they aren&apos;t real people. Treat what you see as hypotheses.
              Every report ends with concrete interview and survey questions so you can check them with real customers.
            </p>
          </FadeIn>
          <FadeIn delay={0.1} className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="font-medium">Good for</h3>
              <ul className="mt-4 space-y-3">
                {GOOD_FOR.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="font-medium">Not a substitute for</h3>
              <ul className="mt-4 space-y-3">
                {NOT_FOR.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                    <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <FadeIn className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center lg:py-24">
          <h2 className="font-display text-title text-balance">
            Find out where your idea lands before the market does
          </h2>
          <p className="text-muted-foreground">Free to try. Runs on demo data until you connect an AI key.</p>
          <Button asChild size="lg">
            <Link href="/signup">
              Get started <ArrowRight />
            </Link>
          </Button>
        </FadeIn>
      </section>
    </>
  );
}
