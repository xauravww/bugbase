"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FolderKanban, 
  ListTodo, 
  Users, 
  Settings,
  LogOut,
  Bug,
  X
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { useMobileSidebar } from "@/hooks/useMobileSidebar";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/issues", label: "My Issues", icon: ListTodo },
];

const adminNavItems = [
  { href: "/team", label: "Team", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isOpen, close } = useMobileSidebar();
  const breakpoint = useBreakpoint();
  
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  // Close sidebar on route change for mobile
  useEffect(() => {
    if (breakpoint === 'mobile') {
      close();
    }
  }, [pathname, breakpoint, close]);

  return (
    <>
      {/* Mobile sidebar overlay */}
      <div 
        className={cn("mobile-sidebar-overlay", {
          "open": isOpen && breakpoint === 'mobile'
        })}
        onClick={close}
      />
      
      {/* Sidebar - desktop and mobile */}
      <aside className={cn(
        "fixed left-0 top-0 bottom-0 bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)] flex flex-col transition-transform duration-300 z-50",
        {
          "mobile-sidebar": breakpoint === 'mobile',
          "w-[var(--sidebar-width)]": breakpoint !== 'mobile',
          "w-[var(--mobile-sidebar-width)]": breakpoint === 'mobile',
          "transform-none": breakpoint !== 'mobile',
          "-translate-x-full": breakpoint === 'mobile' && !isOpen,
          "translate-x-0": breakpoint === 'mobile' && isOpen,
        }
      )}>
        {/* Mobile header with close button */}
        {breakpoint === 'mobile' && (
          <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[var(--color-accent)] rounded flex items-center justify-center">
                <Bug className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-[var(--color-text-primary)]">
                BugBase
              </span>
            </Link>
            <button 
              onClick={close}
              className="p-2 rounded-md hover:bg-[var(--color-hover-bg)] transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Desktop logo */}
        {(breakpoint === 'tablet' || breakpoint === 'desktop') && (
          <div className="p-4 border-b border-[var(--color-border)]">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[var(--color-accent)] rounded flex items-center justify-center">
                <Bug className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-[var(--color-text-primary)]">
                BugBase
              </span>
            </Link>
          </div>
        )}
        
        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors touch-target",
                    isActive(item.href)
                      ? "bg-[var(--color-hover-bg)] text-[var(--color-text-primary)] border-l-[3px] border-[var(--color-accent)] -ml-[3px] pl-[calc(0.75rem+3px)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover-bg)] hover:text-[var(--color-text-primary)]"
                  )}
                  onClick={() => breakpoint === 'mobile' && close()}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              </li>
            ))}
            
            {/* Admin-only items */}
            {user?.role === "Admin" && (
              <>
                <li className="pt-4 pb-2">
                  <span className="px-3 text-xs font-medium text-[var(--color-text-placeholder)] uppercase tracking-wider desktop-only">
                    Admin
                  </span>
                  <span className="px-3 text-xs font-medium text-[var(--color-text-placeholder)] uppercase tracking-wider mobile-only tablet-only">
                    ADMIN
                  </span>
                </li>
                {adminNavItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors touch-target",
                        isActive(item.href)
                          ? "bg-[var(--color-hover-bg)] text-[var(--color-text-primary)] border-l-[3px] border-[var(--color-accent)] -ml-[3px] pl-[calc(0.75rem+3px)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover-bg)] hover:text-[var(--color-text-primary)]"
                      )}
                      onClick={() => breakpoint === 'mobile' && close()}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>
        
        {/* User Section */}
        <div className="p-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3 mb-3">
            {user && <Avatar name={user.name} size="md" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {user?.name}
              </p>
              <Badge variant="default" className="text-[10px]">
                {user?.role}
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Link
              href="/settings"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-hover-bg)] rounded-md transition-colors touch-target"
              onClick={() => breakpoint === 'mobile' && close()}
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="desktop-only">Settings</span>
              <span className="mobile-only tablet-only">Set</span>
            </Link>
            <button
              onClick={() => { logout(); if (breakpoint === 'mobile') close(); }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-hover-bg)] rounded-md transition-colors touch-target"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="desktop-only">Logout</span>
              <span className="mobile-only tablet-only">Log</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
