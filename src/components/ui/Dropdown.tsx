"use client";

import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Align = "start" | "end" | "center";
type Side = "top" | "bottom";

interface DropdownTriggerArgs {
  open: boolean;
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
}

interface DropdownProps {
  trigger: (args: DropdownTriggerArgs) => ReactNode;
  align?: Align;
  side?: Side;
  /** Minimum menu width in px (default: trigger width). */
  minWidth?: number;
  className?: string;
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface MenuContextType {
  close: () => void;
}
const MenuContext = createContext<MenuContextType>({ close: () => {} });

interface Position {
  top: number;
  left: number;
  width: number;
}

const VIEWPORT_GAP = 8;

export function Dropdown({
  trigger,
  align = "start",
  side = "bottom",
  minWidth,
  className,
  children,
  open: openProp,
  onOpenChange,
}: DropdownProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0, width: 0 });
  const [activeIndex, setActiveIndex] = useState(-1);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  useEffect(() => setMounted(true), []);

  const positionMenu = useCallback(() => {
    const trig = triggerRef.current;
    const menu = menuRef.current;
    if (!trig || !menu) return;
    const r = trig.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const width = Math.max(r.width, minWidth ?? 0, m.width);

    let top = side === "bottom" ? r.bottom + 4 : r.top - m.height - 4;
    let left =
      align === "start"
        ? r.left
        : align === "end"
        ? r.right - width
        : r.left + r.width / 2 - width / 2;

    // Auto-flip vertically if overflow.
    if (side === "bottom" && top + m.height > window.innerHeight - VIEWPORT_GAP) {
      top = r.top - m.height - 4;
    } else if (side === "top" && top < VIEWPORT_GAP) {
      top = r.bottom + 4;
    }
    // Clamp horizontally.
    left = Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - width - VIEWPORT_GAP));

    setPos({ top, left, width });
  }, [align, side, minWidth]);

  // Compute position on open and on resize/scroll.
  useEffect(() => {
    if (!open) return;
    positionMenu();
    const onResize = () => positionMenu();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, positionMenu]);

  // Click outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        menuRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  // Keyboard nav inside menu.
  useEffect(() => {
    if (!open) return;
    const items = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>("[data-dropdown-item]:not([data-disabled])") ?? []
      );

    const handler = (e: KeyboardEvent) => {
      const list = items();
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => {
          const next = i + 1 >= list.length ? 0 : i + 1;
          list[next]?.focus();
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => {
          const next = i - 1 < 0 ? list.length - 1 : i - 1;
          list[next]?.focus();
          return next;
        });
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0]?.focus();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1]?.focus();
        setActiveIndex(list.length - 1);
      } else if (e.key === "Tab") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  // Focus first item on open.
  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector<HTMLElement>("[data-dropdown-item]:not([data-disabled])");
      first?.focus();
      setActiveIndex(0);
    });
  }, [open]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Avoid React warnings: only render children when mounted on client.
  const triggerNode = trigger({
    open,
    ref: triggerRef,
    onClick: () => setOpen(!open),
    "aria-haspopup": "menu",
    "aria-expanded": open,
  });

  return (
    <>
      {triggerNode}
      {mounted && open
        ? createPortal(
            <MenuContext.Provider value={{ close }}>
              <div
                ref={menuRef}
                id={id}
                role="menu"
                className={cn(
                  "fixed z-[200] py-1 min-w-[160px]",
                  "bg-surface border border-border rounded-lg shadow-popover",
                  "animate-in-scale focus:outline-none",
                  className
                )}
                style={{ top: pos.top, left: pos.left, minWidth: pos.width || undefined }}
              >
                {Children.map(children, (child) =>
                  isValidElement(child) ? child : null
                )}
              </div>
            </MenuContext.Provider>,
            document.body
          )
        : null}
    </>
  );
}

// ----- Children -----

interface DropdownItemProps {
  icon?: LucideIcon;
  shortcut?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  children: ReactNode;
  className?: string;
}

export function DropdownItem({
  icon: Icon,
  shortcut,
  danger,
  disabled,
  selected,
  onSelect,
  children,
  className,
}: DropdownItemProps) {
  const { close } = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      data-dropdown-item
      data-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        close();
      }}
      className={cn(
        "w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md mx-1",
        "focus:outline-none",
        "transition-colors duration-[var(--duration-fast)]",
        danger
          ? "text-danger hover:bg-danger-bg focus:bg-danger-bg"
          : selected
          ? "bg-accent-subtle text-accent hover:bg-accent/20 focus:bg-accent/20"
          : "text-fg hover:bg-bg-hover focus:bg-bg-hover",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      style={{ width: "calc(100% - 0.5rem)" }}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" aria-hidden />}
      <span className="flex-1 text-left truncate">{children}</span>
      {shortcut && (
        <span className="ml-auto text-xs text-fg-muted font-mono">{shortcut}</span>
      )}
    </button>
  );
}

export function DropdownSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}

interface DropdownLabelProps {
  children: ReactNode;
  className?: string;
}

export function DropdownLabel({ children, className }: DropdownLabelProps) {
  return (
    <div
      className={cn(
        "px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-fg-subtle",
        className
      )}
    >
      {children}
    </div>
  );
}
