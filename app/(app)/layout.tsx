import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { TopBar } from "@/features/shell/top-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
