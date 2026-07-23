"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Users,
  Settings,
  LogOut,
  Bug,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  Moon,
  GanttChart,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, Badge, Button, IconButton, Kbd } from "@/components/ui";
import { useMobileSidebar } from "@/hooks/useMobileSidebar";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/issues", label: "My Issues", icon: ListTodo },
  { href: "/timeline", label: "Timeline", icon: GanttChart },
];

const adminNavItems = [
  { href: "/team", label: "Team", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { isOpen, close, isCollapsed, toggleCollapse } = useMobileSidebar();
  const breakpoint = useBreakpoint();

  const isDesktop = breakpoint === "tablet" || breakpoint === "desktop";
  const collapsed = isDesktop && isCollapsed;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  // Close on route change for mobile.
  useEffect(() => {
    if (breakpoint === "mobile") close();
  }, [pathname, breakpoint, close]);

  const renderNavItem = (item: { href: string; label: string; icon: typeof LayoutDashboard }) => {
    const Active = isActive(item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={() => breakpoint === "mobile" && close()}
          title={collapsed ? item.label : undefined}
          className={cn(
            "group relative flex items-center gap-3 px-3 py-2 text-sm rounded-md touch-target",
            "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
            collapsed && "justify-center px-2",
            Active
              ? "bg-bg-selected text-fg font-medium"
              : "text-fg-muted hover:bg-bg-hover hover:text-fg"
          )}
        >
          {Active && (
            <span
              aria-hidden
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent"
            />
          )}
          <item.icon
            className={cn(
              "w-4 h-4 flex-shrink-0",
              Active ? "text-accent" : "text-current"
            )}
          />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        </Link>
      </li>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn("mobile-sidebar-overlay", {
          open: isOpen && breakpoint === "mobile",
        })}
        onClick={close}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 flex flex-col",
          "bg-sidebar",
          "transition-[width,transform] duration-[var(--duration-base)] ease-[var(--ease-out)]",
          {
            "mobile-sidebar": breakpoint === "mobile",
            "w-[var(--mobile-sidebar-width)]": breakpoint === "mobile",
            "-translate-x-full": breakpoint === "mobile" && !isOpen,
            "translate-x-0": breakpoint === "mobile" && isOpen,
            "w-16": collapsed,
            "w-[var(--sidebar-width)]": isDesktop && !collapsed,
          }
        )}
      >
        {/* Mobile header with close */}
        {breakpoint === "mobile" && (
          <div className="px-4 h-14 flex justify-between items-center">
            <Brand />
            <IconButton
              icon={X}
              label="Close menu"
              variant="ghost"
              size="sm"
              onClick={close}
            />
          </div>
        )}

        {/* Desktop logo */}
        {isDesktop && (
          <div
            className={cn(
              "px-3 h-14 flex items-center",
              collapsed && "justify-center px-2"
            )}
          >
            <Brand collapsed={collapsed} />
          </div>
        )}

        {/* New Issue CTA */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={Plus}
              className="w-full justify-start"
              onClick={() => router.push("/issues?new=1")}
            >
              <span className="flex-1 text-left">New issue</span>
              <Kbd className="ml-2 bg-white/10 border-white/20 text-white/80">C</Kbd>
            </Button>
          </div>
        )}
        {collapsed && (
          <div className="px-2 pt-3 flex justify-center">
            <IconButton
              icon={Plus}
              label="New issue"
              variant="primary"
              size="md"
              tooltip
              onClick={() => router.push("/issues?new=1")}
            />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 pt-3 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map(renderNavItem)}

            {user?.role === "Admin" && (
              <>
                {!collapsed ? (
                  <li className="pt-4 pb-1.5 px-3">
                    <span className="text-[11px] font-medium text-fg-subtle uppercase tracking-wider">
                      Admin
                    </span>
                  </li>
                ) : (
                  <li className="pt-3 pb-1">
                    <hr className="border-sidebar-border mx-2" />
                  </li>
                )}
                {adminNavItems.map(renderNavItem)}
              </>
            )}
          </ul>
        </nav>

        {/* Theme + collapse + user */}
        <div className="mt-auto">
          {isDesktop && (
            <div className={cn("px-2 py-1", collapsed && "flex justify-center")}>
              <button
                onClick={toggleCollapse}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer",
                  "text-fg-muted hover:bg-bg-hover hover:text-fg",
                  "transition-colors duration-[var(--duration-fast)]",
                  collapsed && "justify-center px-2 w-auto"
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 flex-shrink-0" />
                )}
                {!collapsed && <span className="flex-1 text-left">Collapse</span>}
              </button>
            </div>
          )}

          {/* User block */}
          <div className="p-3">
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                {user && <Avatar name={user.name} size="md" />}
                <Link
                  href="/settings"
                  title="Settings"
                  className="p-2 text-fg-muted hover:text-fg hover:bg-bg-hover rounded-md transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-2 text-danger hover:bg-danger-bg rounded-md transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {user && <Avatar name={user.name} size="md" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{user?.name}</p>
                    {user?.role && (
                      <Badge variant="neutral" size="sm" className="text-[10px]">
                        {user.role}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <Link
                    href="/settings"
                    onClick={() => breakpoint === "mobile" && close()}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-1.5 px-2 h-8 text-xs rounded-md",
                      "text-fg-muted hover:bg-bg-hover hover:text-fg",
                      "transition-colors duration-[var(--duration-fast)]"
                    )}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      if (breakpoint === "mobile") close();
                    }}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-1.5 px-2 h-8 text-xs rounded-md cursor-pointer",
                      "text-danger hover:bg-danger-bg",
                      "transition-colors duration-[var(--duration-fast)]"
                    )}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function Brand({ collapsed }: { collapsed?: boolean } = {}) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex items-center gap-2.5 min-w-0", collapsed && "justify-center")}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0",
          "bg-gradient-to-br from-accent to-accent-active",
          "shadow-[0_0_0_1px_var(--accent-ring),0_6px_18px_var(--accent-ring)]"
        )}
      >
        <Bug className="w-4 h-4 text-white" strokeWidth={2.5} />
      </span>
      {!collapsed && (
        <span className="font-semibold text-fg tracking-tight">BugBase</span>
      )}
    </Link>
  );
}
