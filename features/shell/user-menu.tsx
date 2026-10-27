import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { logOut } from "@/features/auth/actions";
import { requireUser } from "@/lib/auth";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export async function UserMenu() {
  const user = await requireUser();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open account menu">
          <Avatar className="size-8">
            <AvatarFallback className="bg-brand-soft text-xs font-medium text-brand-soft-foreground">
              {initials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.name ?? "Your account"}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Log out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenuSkeleton() {
  return <Skeleton className="size-8 rounded-full" />;
}
