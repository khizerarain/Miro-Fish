"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, LogoMark } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_NAV } from "./nav";

export function AppSidebar() {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3">
        {collapsed ? (
          <Link href="/dashboard" aria-label="Miro Fish home" className="mx-auto">
            <LogoMark className="size-6" />
          </Link>
        ) : (
          <Logo href="/dashboard" />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {APP_NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href} onClick={closeOnMobile} aria-current={active ? "page" : undefined}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="New experiment" variant="outline">
              <Link href="/experiments/new" onClick={closeOnMobile}>
                <Plus />
                <span>New experiment</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
