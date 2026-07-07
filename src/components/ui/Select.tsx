"use client";

import {
  forwardRef,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Dropdown, DropdownItem } from "./Dropdown";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional small icon shown left of the label. */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "size" | "onChange" | "value" | "defaultValue"
  > {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  /** Show a search box inside the menu. */
  searchable?: boolean;
  fullWidth?: boolean;
  wrapperClassName?: string;
}

/**
 * Custom-rendered select built on Dropdown — no native chrome.
 * Back-compat: keeps a hidden <select> so existing callers using
 * `e.target.value` / `name=` form fields keep working unchanged.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      wrapperClassName,
      label,
      error,
      hint,
      options,
      value,
      defaultValue,
      placeholder = "Select…",
      onChange,
      searchable = false,
      fullWidth = true,
      id,
      name,
      disabled,
      ...nativeProps
    },
    forwardedRef
  ) => {
    const hiddenRef = useRef<HTMLSelectElement>(null);
    const [internal, setInternal] = useState<string>(defaultValue ?? "");
    const [search, setSearch] = useState("");

    const isControlled = value !== undefined;
    const current = isControlled ? value : internal;
    const selected = options.find((o) => o.value === current);

    const filtered = useMemo(() => {
      if (!searchable || !search.trim()) return options;
      const q = search.toLowerCase();
      return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, search, searchable]);

    const commit = (next: string) => {
      if (!isControlled) setInternal(next);
      if (!onChange) return;
      // Most callers only read e.target.value / e.target.name. Fabricate a minimal
      // event-shaped object that satisfies the common case without doing real
      // event dispatch (which React's synthetic system wouldn't pick up anyway).
      const el = hiddenRef.current ?? ({} as HTMLSelectElement);
      const fakeTarget = Object.assign(el, { value: next, name: name ?? "" });
      onChange({
        target: fakeTarget,
        currentTarget: fakeTarget,
      } as unknown as ChangeEvent<HTMLSelectElement>);
    };

    return (
      <div className={cn(fullWidth && "w-full", wrapperClassName)}>
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-fg mb-1.5"
          >
            {label}
          </label>
        )}

        {/* Hidden native select for form submission + ref forwarding. */}
        <select
          ref={(el) => {
            hiddenRef.current = el;
            if (typeof forwardedRef === "function") forwardedRef(el);
            else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLSelectElement | null>).current = el;
          }}
          id={id}
          name={name}
          value={current}
          onChange={(e) => {
            if (!isControlled) setInternal(e.target.value);
            onChange?.(e);
          }}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          {...nativeProps}
        >
          {!current && <option value="" />}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        <Dropdown
          align="start"
          side="bottom"
          trigger={({ open, ref, onClick, ...rest }) => (
            <button
              type="button"
              ref={ref}
              onClick={onClick}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              className={cn(
                "w-full h-9 px-3 inline-flex items-center justify-between gap-2",
                "text-sm rounded-md bg-surface border border-border text-fg",
                "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                "hover:border-border-strong",
                "focus-visible:outline-none",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-subtle",
                open && "border-accent",
                error && "border-danger",
                className
              )}
              {...rest}
            >
              <span className={cn("truncate", !selected && "text-fg-placeholder")}>
                {selected ? (
                  <span className="inline-flex items-center gap-2">
                    {selected.icon}
                    {selected.label}
                  </span>
                ) : (
                  placeholder
                )}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-fg-muted flex-shrink-0 transition-transform",
                  open && "rotate-180"
                )}
                aria-hidden
              />
            </button>
          )}
        >
          {searchable && (
            <div className="px-2 pb-1 pt-1 sticky top-0 bg-surface">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className={cn(
                    "w-full h-8 pl-7 pr-2 text-sm rounded-md",
                    "bg-bg-subtle border border-border text-fg placeholder:text-fg-placeholder",
                    "focus:outline-none"
                  )}
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-fg-placeholder">
                No matches
              </div>
            ) : (
              filtered.map((o) => (
                <DropdownItem
                  key={o.value}
                  disabled={o.disabled}
                  selected={o.value === current}
                  onSelect={() => commit(o.value)}
                  shortcut={o.value === current ? <Check className="w-4 h-4 text-accent flex-shrink-0" aria-hidden /> : undefined}
                >
                  <span className="inline-flex items-center gap-2">
                    {o.icon}
                    {o.label}
                  </span>
                </DropdownItem>
              ))
            )}
          </div>
        </Dropdown>

        {error ? (
          <p className="mt-1 text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-xs text-fg-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
