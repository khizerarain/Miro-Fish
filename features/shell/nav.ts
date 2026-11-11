import { FlaskConical, FolderKanban, LayoutDashboard, Settings, Users } from "lucide-react";

export const APP_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/audiences", label: "Audiences", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
