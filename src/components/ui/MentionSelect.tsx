"use client";

import { forwardRef, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { Search, X, Check } from "lucide-react";

export interface MentionSelectProps {
  label?: string;
  error?: string;
  options: { value: string; label: string; icon?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

export const MentionSelect = forwardRef<HTMLInputElement, MentionSelectProps>(
  (
    {
      className,
      label,
      error,
      options,
      value,
      onChange,
      placeholder = "Search...",
      emptyMessage = "No options found",
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
    const selectedOption = options.find((opt) => opt.value === value);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
      <div className="w-full relative" ref={containerRef}>
        {label && (
          <label className="block text-sm font-medium text-fg mb-1.5">{label}</label>
        )}

        {selectedOption && !isOpen ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={cn(
              "w-full h-9 flex items-center justify-between px-3 text-sm rounded-md",
              "bg-surface border border-border text-fg transition-colors",
              "hover:border-border-strong",
              "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring"
            )}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-[11px] font-mono flex-shrink-0">
                @
              </span>
              <span className="truncate">{selectedOption.label}</span>
            </span>
            <X
              className="w-4 h-4 text-fg-muted hover:text-fg flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          </button>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
            <input
              ref={ref}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              className={cn(
                "w-full h-9 pl-9 pr-3 text-sm rounded-md",
                "bg-surface border border-border text-fg placeholder:text-fg-placeholder",
                "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                "hover:border-border-strong",
                "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                error && "border-danger focus:border-danger focus:ring-danger/30",
                className
              )}
            />
          </div>
        )}

        {isOpen && search && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-surface shadow-popover z-50">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-fg-placeholder">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setSearch("");
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left text-fg hover:bg-bg-hover transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-[11px] font-mono flex-shrink-0">
                      @
                    </span>
                    <span className="truncate">{option.label}</span>
                  </span>
                  {option.value === value && (
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

MentionSelect.displayName = "MentionSelect";

export default MentionSelect;
