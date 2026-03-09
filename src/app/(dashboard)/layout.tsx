"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/layout";
import { PageLoader } from "@/components/ui";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { MobileSidebarProvider, useMobileSidebar } from "@/hooks/useMobileSidebar";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const { isCollapsed } = useMobileSidebar();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isDesktop = breakpoint === 'tablet' || breakpoint === 'desktop';

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      <Sidebar />
      <main
        className="flex-1 overflow-auto transition-all duration-300"
        style={{
          marginLeft: breakpoint === 'mobile' ? 0 : isDesktop && isCollapsed ? '4rem' : 'var(--sidebar-width)',
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileSidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </MobileSidebarProvider>
  );
}
