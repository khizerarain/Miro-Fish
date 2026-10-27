import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 text-primary", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M7 16c3-4.5 7-6.5 11-6.5 2.6 0 4.8 1 6.5 2.6L27 9.5v13l-2.5-2.6C22.8 21.5 20.6 22.5 18 22.5c-4 0-8-2-11-6.5Z"
        className="fill-primary-foreground"
      />
      <circle cx="19.5" cy="15" r="1.4" className="fill-primary" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-md font-medium", className)}>
      <LogoMark />
      <span className="text-sm tracking-tight">Miro Fish</span>
    </Link>
  );
}
