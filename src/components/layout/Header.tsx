"use client";

import { useEffect, useState } from "react";
import { Search, Menu, Plus, Bell } from "lucide-react";
import { Input, IconButton, Kbd, Avatar } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useMobileSidebar } from "@/hooks/useMobileSidebar";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils/cn";

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
  onMobileAction?: () => void;
  showMobileAdd?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Hide the search input entirely on desktop. */
  hideSearch?: boolean;
}

export function Header({
  title,
  children,
  onMobileAction,
  showMobileAdd,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  hideSearch,
}: HeaderProps) {
  const { toggle } = useMobileSidebar();
  const { user } = useAuth();
  const breakpoint = useBreakpoint();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Pre-mount placeholder to avoid hydration jitter.
  if (!mounted) {
    return (
      <header className="sticky top-0 z-10 bg-bg border-b border-border mobile-header">
        <button
          className="p-2 rounded-md hover:bg-bg-hover transition-colors touch-target"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-fg truncate">{title}</h1>
        <div className="w-10" />
      </header>
    );
  }

  return (
    <>
      {/* Mobile header */}
      {breakpoint === "mobile" && (
        <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/70 border-b border-border mobile-header">
          <IconButton icon={Menu} label="Open menu" variant="ghost" onClick={toggle} />
          <h1 className="text-base font-semibold text-fg truncate tracking-tight">{title}</h1>
          <div className="flex items-center justify-center">
            {showMobileAdd && onMobileAction && (
              <IconButton
                icon={Plus}
                label="Add"
                variant="primary"
                onClick={onMobileAction}
              />
            )}
          </div>
        </header>
      )}

      {/* Desktop / tablet header */}
      {(breakpoint === "tablet" || breakpoint === "desktop") && (
        <header
          className={cn(
            "sticky top-0 z-10 border-b border-border",
            "bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/70"
          )}
        >
          <div className="flex items-center justify-between gap-4 px-6 h-14">
            <h1 className="text-base font-semibold text-fg tracking-tight truncate">
              {title}
            </h1>

            <div className="flex items-center gap-2">
              {!hideSearch && (
                <Input
                  type="search"
                  leftIcon={Search}
                  placeholder={searchPlaceholder || "Search issues..."}
                  className="w-64"
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  rightSlot={<Kbd>⌘K</Kbd>}
                />
              )}

              {/* Page-supplied actions */}
              {children}

              {breakpoint === "desktop" && (
                <>
                  {user && (
                    <div className="ml-1">
                      <Avatar name={user.name} size="sm" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </header>
      )}
    </>
  );
}
