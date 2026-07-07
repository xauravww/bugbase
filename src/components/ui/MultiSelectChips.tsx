"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { Search, X, Check, ChevronDown, Plus } from "lucide-react";
import { contrastingText } from "@/lib/categories";

export interface MultiSelectOption {
  id: number;
  label: string;
  color?: string;
}

export interface MultiSelectChipsProps {
  label?: string;
  options: MultiSelectOption[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  onCreateOption?: (name: string) => void;
  isCreating?: boolean;
}

export function MultiSelectChips({
  label,
  options,
  value,
  onChange,
  placeholder = "Add...",
  emptyMessage = "No options",
  className,
  disabled,
  searchable = true,
  onCreateOption,
  isCreating,
}: MultiSelectChipsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () =>
      value.map((id) => options.find((o) => o.id === id)).filter(Boolean) as MultiSelectOption[],
    [value, options]
  );

  const filtered = useMemo(
    () =>
      options.filter((o) =>
        searchable && search ? o.label.toLowerCase().includes(search.toLowerCase()) : true
      ),
    [options, search, searchable]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, searchable]);

  const toggle = (id: number) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const remove = (id: number) => onChange(value.filter((v) => v !== id));

  return (
    <div className={cn("w-full relative", className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-fg mb-1.5">{label}</label>
      )}

      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 min-h-[40px] px-2 py-1.5 rounded-md border",
          "bg-surface border-border transition-colors",
          !disabled && "cursor-text hover:border-border-strong",
          isOpen && !disabled && "border-accent ring-2 ring-accent-ring",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        onClick={() => !disabled && setIsOpen(true)}
      >
        {selected.map((opt) => {
          // Honor user-set color (categories); fallback to accent-subtle/accent.
          const customColor = !!opt.color;
          const fg = customColor && opt.color ? contrastingText(opt.color) : undefined;
          return (
            <span
              key={opt.id}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                !customColor && "bg-accent-subtle text-accent"
              )}
              style={
                customColor && opt.color
                  ? { backgroundColor: opt.color, color: fg }
                  : undefined
              }
            >
              {opt.label}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(opt.id);
                  }}
                  className="hover:opacity-70"
                  aria-label={`Remove ${opt.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          );
        })}
        {!disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((v) => !v);
            }}
            className={cn(
              "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
              "border border-dashed border-border text-fg-muted",
              "hover:bg-bg-hover hover:border-border-strong hover:text-fg",
              "transition-colors"
            )}
          >
            <Plus className="w-3 h-3" />
            {selected.length === 0 ? placeholder : "Add"}
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-surface shadow-popover z-50">
          {searchable && (
            <div className="sticky top-0 p-2 border-b border-border bg-surface">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className={cn(
                    "w-full h-8 pl-7 pr-2 text-sm rounded-md",
                    "bg-bg-subtle border border-border text-fg placeholder:text-fg-placeholder",
                    "focus:outline-none"
                  )}
                />
              </div>
            </div>
          )}
          {searchable &&
            search.trim() !== "" &&
            onCreateOption &&
            !options.some((o) => o.label.toLowerCase() === search.trim().toLowerCase()) && (
              <div className="border-b border-border">
                <button
                  type="button"
                  onClick={() => {
                    onCreateOption(search.trim());
                    setSearch("");
                  }}
                  disabled={isCreating}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-accent hover:bg-bg-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {isCreating ? "Creating..." : `Create "${search.trim()}"`}
                </button>
              </div>
            )}
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-center text-fg-placeholder">
              {emptyMessage}
            </div>
          ) : (
            filtered.map((opt) => {
              const isSelected = value.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left text-fg hover:bg-bg-hover transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {opt.color && (
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-accent" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default MultiSelectChips;
