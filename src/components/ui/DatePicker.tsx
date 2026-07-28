"use client";

import { forwardRef, useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FieldHelpButton, type FieldHelpContent } from "./FieldHelp";

export interface DatePickerProps {
  value?: string | number | null;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  wrapperClassName?: string;
  id?: string;
  name?: string;
  help?: Partial<FieldHelpContent>;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      label,
      error,
      hint,
      placeholder = "Select date…",
      disabled = false,
      min,
      max,
      className,
      wrapperClassName,
      id,
      name,
      help,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const parseValue = (val: unknown): string => {
      if (!val) return "";
      if (typeof val === "number") {
        return new Date(val).toISOString().slice(0, 10);
      }
      const s = String(val).trim();
      if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.slice(0, 10);
      }
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
      return "";
    };

    const dateStr = parseValue(value);

    const initialDate = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
    const [viewYear, setViewYear] = useState(initialDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

    useEffect(() => {
      if (dateStr) {
        const d = new Date(dateStr + "T00:00:00");
        if (!isNaN(d.getTime())) {
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
        }
      }
    }, [dateStr]);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    const handleSelectDate = (formattedDate: string) => {
      onChange?.(formattedDate);
      setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.("");
    };

    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const prevMonth = () => {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((y) => y - 1);
      } else {
        setViewMonth((m) => m - 1);
      }
    };

    const nextMonth = () => {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((y) => y + 1);
      } else {
        setViewMonth((m) => m + 1);
      }
    };

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const todayStr = new Date().toISOString().slice(0, 10);

    const getPreset = (offsetDays: number): string => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    };

    const formatDisplay = (ds: string): string => {
      if (!ds) return "";
      const d = new Date(ds + "T00:00:00");
      if (isNaN(d.getTime())) return ds;
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    return (
      <div className={cn("w-full relative", wrapperClassName)} ref={containerRef}>
        {label && (
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor={id} className="block text-sm font-medium text-fg min-w-0">
              {label}
            </label>
            <FieldHelpButton
              label={label}
              kind="date"
              placeholder={placeholder}
              content={help}
            />
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            ref={ref}
            id={id}
            name={name}
            readOnly
            disabled={disabled}
            value={formatDisplay(dateStr)}
            placeholder={placeholder}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={cn(
              "w-full h-9 pl-9 pr-9 text-sm rounded-md cursor-pointer select-none",
              "bg-surface border border-border text-fg",
              "placeholder:text-fg-placeholder",
              "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              "hover:border-border-strong focus:outline-none focus:border-accent",
              disabled && "opacity-50 cursor-not-allowed bg-bg-subtle",
              error && "border-danger",
              className
            )}
          />
          <Calendar
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted"
            aria-hidden
          />
          {dateStr && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-fg-muted hover:text-fg rounded transition-colors"
              title="Clear date"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => !disabled && setIsOpen(!isOpen)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-fg-muted hover:text-fg rounded transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {error ? (
          <p className="mt-1 text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-xs text-fg-muted">{hint}</p>
        ) : null}

        {isOpen && (
          <div className="absolute z-50 mt-1 w-72 p-3 rounded-lg border border-border bg-surface shadow-lg text-fg animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-md hover:bg-bg-subtle text-fg-muted hover:text-fg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-semibold text-fg">
                {months[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 rounded-md hover:bg-bg-subtle text-fg-muted hover:text-fg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-1 mb-3 pb-2 border-b border-border text-[11px]">
              <button
                type="button"
                onClick={() => handleSelectDate(todayStr)}
                className="px-2 py-1 rounded bg-bg-subtle hover:bg-accent/10 hover:text-accent font-medium text-fg-muted transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSelectDate(getPreset(1))}
                className="px-2 py-1 rounded bg-bg-subtle hover:bg-accent/10 hover:text-accent font-medium text-fg-muted transition-colors"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => handleSelectDate(getPreset(7))}
                className="px-2 py-1 rounded bg-bg-subtle hover:bg-accent/10 hover:text-accent font-medium text-fg-muted transition-colors"
              >
                +1 Wk
              </button>
              <button
                type="button"
                onClick={() => handleSelectDate(getPreset(30))}
                className="px-2 py-1 rounded bg-bg-subtle hover:bg-accent/10 hover:text-accent font-medium text-fg-muted transition-colors"
              >
                +1 Mo
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-fg-muted mb-1">
              <div>Su</div>
              <div>Mo</div>
              <div>Tu</div>
              <div>We</div>
              <div>Th</div>
              <div>Fr</div>
              <div>Sa</div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => {
                const dayNum = daysInPrevMonth - firstDayOfMonth + i + 1;
                return (
                  <div key={`prev-${i}`} className="py-1.5 text-fg-muted/40 pointer-events-none">
                    {dayNum}
                  </div>
                );
              })}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const mStr = String(viewMonth + 1).padStart(2, "0");
                const dStr = String(dayNum).padStart(2, "0");
                const currentFullStr = `${viewYear}-${mStr}-${dStr}`;

                const isSelected = dateStr === currentFullStr;
                const isToday = todayStr === currentFullStr;

                const isMinDisabled = min && currentFullStr < min;
                const isMaxDisabled = max && currentFullStr > max;
                const isDisabledDay = Boolean(isMinDisabled || isMaxDisabled);

                return (
                  <button
                    key={`curr-${dayNum}`}
                    type="button"
                    disabled={isDisabledDay}
                    onClick={() => handleSelectDate(currentFullStr)}
                    className={cn(
                      "py-1.5 rounded-md font-medium transition-colors relative",
                      isSelected
                        ? "bg-accent text-white font-bold"
                        : isToday
                        ? "bg-accent/15 text-accent border border-accent/40 font-semibold"
                        : "hover:bg-bg-subtle text-fg",
                      isDisabledDay && "opacity-30 cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
