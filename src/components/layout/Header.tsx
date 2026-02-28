"use client";

import { useEffect, useState } from "react";
import { Search, Menu, Plus } from "lucide-react";
import { Input } from "@/components/ui";
import { useMobileSidebar } from "@/hooks/useMobileSidebar";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
  onMobileAction?: () => void;
  showMobileAdd?: boolean;
}

export function Header({ title, children, onMobileAction, showMobileAdd }: HeaderProps) {
  const { toggle } = useMobileSidebar();
  const breakpoint = useBreakpoint();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = () => {
      if (breakpoint === 'mobile') {
        // We'll handle closing in the sidebar itself when clicking overlay
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [breakpoint]);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <header className="sticky top-0 z-10 bg-white border-b border-[var(--color-border)] mobile-header">
        <button
          className="p-2 rounded-md hover:bg-[var(--color-hover-bg)] transition-colors touch-target"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
          {title}
        </h1>
        <div className="w-10"></div>
      </header>
    );
  }

  return (
    <>
      {/* Mobile header */}
      {breakpoint === 'mobile' && (
        <header className="sticky top-0 z-10 bg-white border-b border-[var(--color-border)] mobile-header">
          <button
            onClick={toggle}
            className="p-2 rounded-md hover:bg-[var(--color-hover-bg)] transition-colors touch-target"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
            {title}
          </h1>
          <div className="flex items-center justify-center">
            {showMobileAdd && onMobileAction && (
              <button
                onClick={onMobileAction}
                className="p-2 rounded-md bg-[var(--color-text-primary)] text-white touch-target flex items-center justify-center"
                aria-label="Add"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>
      )}

      {/* Desktop header */}
      {(breakpoint === 'tablet' || breakpoint === 'desktop') && (
        <header className="sticky top-0 z-10 bg-white border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
              {title}
            </h1>
            
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-placeholder)]" />
                <Input
                  type="search"
                  placeholder="Search issues..."
                  className="pl-9 w-64"
                />
              </div>
              
              {/* Action buttons */}
              {children}
            </div>
          </div>
        </header>
      )}
    </>
  );
}
