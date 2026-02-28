"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/layout";
import { PageLoader } from "@/components/ui";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { MobileSidebarProvider } from "@/hooks/useMobileSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const breakpoint = useBreakpoint();

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

  return (
    <MobileSidebarProvider>
      <div className="h-screen flex bg-white overflow-hidden">
        <Sidebar />
        <main className={`flex-1 overflow-auto ${breakpoint === 'mobile' ? 'ml-0' : 'ml-[var(--sidebar-width)]'}`}>
          {children}
        </main>
      </div>
    </MobileSidebarProvider>
  );
}
