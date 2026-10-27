import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Logo />
          <nav aria-label="Main" className="hidden gap-6 text-sm text-muted-foreground md:flex">
            <Link href="#how-it-works" className="hover:text-foreground">
              How it works
            </Link>
            <Link href="#honesty" className="hover:text-foreground">
              What it is (and isn&apos;t)
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>© 2026 Miro Fish</p>
          <p>Simulated customer research. Directional, not definitive.</p>
        </div>
      </footer>
    </div>
  );
}
