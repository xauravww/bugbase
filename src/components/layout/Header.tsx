"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui";

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
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
  );
}
