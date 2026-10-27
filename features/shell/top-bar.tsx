import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu, UserMenuSkeleton } from "./user-menu";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <SidebarTrigger className="-ml-1" aria-label="Toggle navigation" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <div className="flex-1" />
      <ThemeToggle />
      <Suspense fallback={<UserMenuSkeleton />}>
        <UserMenu />
      </Suspense>
    </header>
  );
}
