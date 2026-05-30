"use client";

import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  delay?: number;
  /** Single focusable child element. */
  children: ReactElement<{
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    "aria-describedby"?: string;
  }>;
  className?: string;
  disabled?: boolean;
}

interface Pos {
  top: number;
  left: number;
}

const GAP = 8;

function calcPosition(rect: DOMRect, side: TooltipSide, tipW: number, tipH: number): Pos {
  switch (side) {
    case "top":
      return { top: rect.top - tipH - GAP, left: rect.left + rect.width / 2 - tipW / 2 };
    case "bottom":
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 - tipW / 2 };
    case "left":
      return { top: rect.top + rect.height / 2 - tipH / 2, left: rect.left - tipW - GAP };
    case "right":
      return { top: rect.top + rect.height / 2 - tipH / 2, left: rect.right + GAP };
  }
}

export function Tooltip({
  content,
  side = "top",
  delay = 300,
  children,
  className,
  disabled,
}: TooltipProps) {
  const id = useId();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    let next = calcPosition(rect, side, tip.width, tip.height);
    // Naive auto-flip if out of viewport.
    if (next.top < 4 && side === "top") next = calcPosition(rect, "bottom", tip.width, tip.height);
    if (next.top + tip.height > window.innerHeight - 4 && side === "bottom")
      next = calcPosition(rect, "top", tip.width, tip.height);
    setPos(next);
  }, [open, side, content]);

  const show = () => {
    if (disabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  const childProps = children.props;
  const trigger = cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      childProps.onMouseEnter?.(e);
      // Capture ref off the event target.
      triggerRef.current = e.currentTarget as HTMLElement;
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      childProps.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      childProps.onFocus?.(e);
      triggerRef.current = e.currentTarget as HTMLElement;
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      childProps.onBlur?.(e);
      hide();
    },
    "aria-describedby": open ? id : undefined,
  });

  return (
    <>
      {trigger}
      {mounted && open
        ? createPortal(
            <div
              ref={tipRef}
              id={id}
              role="tooltip"
              className={cn(
                "fixed z-[200] pointer-events-none",
                "font-mono text-[11px] leading-none",
                "px-2 py-1 rounded-md",
                "bg-fg text-bg shadow-popover",
                "animate-in-fade",
                className
              )}
              style={{ top: pos.top, left: pos.left }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
