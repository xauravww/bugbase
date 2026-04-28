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
  ({ className, label, error, options, value, onChange, placeholder = "Search...", emptyMessage = "No options found" }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(opt => 
      opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(opt => opt.value === value);

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
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}
          >
            {label}
          </label>
        )}
        
        {selectedOption && !isOpen ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border transition-all hover:border-[#5b76fe]"
            style={{ background: "#ffffff", borderColor: "#e9eaef", fontFamily: "DM Sans, sans-serif" }}
          >
            <span className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#f7f6f3] text-xs" style={{ color: "#555a6a" }}>
                @
              </span>
              {selectedOption.label}
            </span>
            <X 
              className="w-4 h-4" 
              style={{ color: "#a5a8b5" }}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          </button>
        ) : (
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search className="w-4 h-4" style={{ color: "#a5a8b5" }} />
            </div>
            <input
              ref={inputRef as any}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className={cn(
                "w-full pl-10 pr-3 py-2 text-sm rounded-lg border transition-all duration-150",
                "focus:outline-none focus:border-[#5b76fe] focus:ring-2 focus:ring-[#5b76fe]/20",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                error && "border-[#eb5757] focus:border-[#eb5757]",
                className
              )}
              style={{ 
                background: "#ffffff", 
                borderColor: error ? "#eb5757" : "#e9eaef",
                fontFamily: "DM Sans, sans-serif"
              }}
            />
          </div>
        )}

        {isOpen && search && (
          <div 
            className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border shadow-lg z-50"
            style={{ background: "#ffffff", borderColor: "#e9eaef" }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center" style={{ color: "#a5a8b5" }}>
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
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-[#f7f6f3] transition-colors"
                  style={{ fontFamily: "DM Sans, sans-serif" }}
                >
                  <span className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#f7f6f3] text-xs" style={{ color: "#555a6a" }}>
                      @
                    </span>
                    <span style={{ color: "#1c1c1e" }}>{option.label}</span>
                  </span>
                  {option.value === value && (
                    <Check className="w-4 h-4" style={{ color: "#5b76fe" }} />
                  )}
                </button>
              ))
            )}
          </div>
        )}
        
        {error && (
          <p className="mt-1 text-xs" style={{ color: "#eb5757" }}>{error}</p>
        )}
      </div>
    );
  }
);

MentionSelect.displayName = "MentionSelect";

export default MentionSelect;