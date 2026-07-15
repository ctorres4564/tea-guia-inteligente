import { type SelectHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-card border bg-white px-3 py-2.5 text-sm text-slate-900",
          "focus:border-brand-500",
          hasError ? "border-red-400" : "border-slate-300",
          className,
        )}
        aria-invalid={hasError || undefined}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = "Select";
