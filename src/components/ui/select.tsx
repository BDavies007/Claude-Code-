import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight native select styled to match the design system. Keeps the
 * dependency footprint small while behaving accessibly out of the box.
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly string[] | readonly { label: string; value: string }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background/60 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {options.map((opt) => {
        const value = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        return (
          <option key={value} value={value} className="bg-card text-foreground">
            {label}
          </option>
        );
      })}
    </select>
  )
);
Select.displayName = "Select";

export { Select };
