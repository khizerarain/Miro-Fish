import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Shortcuts } from "@/components/shortcuts";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { TopBar } from "@/features/shell/top-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <TopBar />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          {children}
        </main>
        <Shortcuts />
      </SidebarInset>
    </SidebarProvider>
  );
}
