import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium mb-1.5"
            style={{ color: "#1c1c1e", fontFamily: "DM Sans, sans-serif" }}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-md border transition-all duration-150 touch-target",
            "focus:outline-none focus:border-[#5b76fe]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#f7f6f3]",
            error && "border-[#eb5757] focus:border-[#eb5757]",
            className
          )}
          style={{ 
            background: "#ffffff", 
            borderColor: error ? "#eb5757" : "#e9eaef",
            fontFamily: "DM Sans, sans-serif"
          }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-xs" style={{ color: "#eb5757" }}>{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
