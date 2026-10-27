import { SimulatedBadge } from "@/components/simulated-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const SAMPLE = [
  {
    name: "Priya, 34",
    role: "Ops lead, mid-size logistics firm",
    intent: "Medium",
    quote: "I like that it plugs into what we already use. I'd need to see it handle our volume before I'd pay for it.",
  },
  {
    name: "Marcus, 52",
    role: "Owner, two-location bakery",
    intent: "None",
    quote: "Honestly this isn't for me. I've got a spreadsheet that works and no time to learn something new.",
  },
  {
    name: "Lena, 27",
    role: "Freelance designer",
    intent: "High",
    quote: "This solves the exact invoicing headache I have every month. $12 feels fair if the export is clean.",
  },
];

const intentStyle: Record<string, string> = {
  High: "bg-primary text-primary-foreground",
  Medium: "bg-brand-soft text-brand-soft-foreground",
  None: "bg-muted text-muted-foreground",
};

/** Static illustration for the landing page. Not real output. */
export function ReactionPreview() {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-lifted">
      <CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <div>
          <p className="text-sm font-medium">Sample reactions</p>
          <p className="text-xs text-muted-foreground">Illustrative example · 3 of 1,000 personas</p>
        </div>
        <SimulatedBadge />
      </CardHeader>
      <CardContent className="divide-y p-0">
        {SAMPLE.map((p) => (
          <div key={p.name} className="space-y-2 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.role}</p>
              </div>
              <Badge className={intentStyle[p.intent]}>{p.intent} intent</Badge>
            </div>
            <p className="text-sm text-pretty text-muted-foreground">&ldquo;{p.quote}&rdquo;</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
