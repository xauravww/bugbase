"use client";

import {
  createContext,
  useContext,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

interface TabsContextType {
  value: string;
  setValue: (v: string) => void;
}
const TabsContext = createContext<TabsContextType | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs.* must be inside <Tabs>");
  return ctx;
}

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, defaultValue, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const setValue = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-1 border-b border-border", className)}
      {...props}
    />
  );
}

interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
}

export function TabsTrigger({ value, className, children, disabled, ...props }: TabsTriggerProps) {
  const { value: current, setValue } = useTabs();
  const active = current === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={cn(
        "relative px-3 py-2 text-sm font-medium",
        "transition-colors duration-[var(--duration-fast)]",
        active ? "text-fg" : "text-fg-muted hover:text-fg",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring rounded-sm",
        className
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "absolute left-2 right-2 -bottom-px h-[2px] rounded-full",
          "transition-all duration-[var(--duration-base)] ease-[var(--ease-out)]",
          active ? "bg-accent opacity-100" : "bg-transparent opacity-0"
        )}
      />
    </button>
  );
}

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const { value: current } = useTabs();
  if (current !== value) return null;
  return (
    <div
      role="tabpanel"
      className={cn("pt-4 focus:outline-none animate-in-fade", className)}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  );
}
