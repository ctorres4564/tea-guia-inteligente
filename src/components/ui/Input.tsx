import { type InputHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-card border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-slate-950 dark:border-slate-800 dark:text-white dark:placeholder:text-slate-500",
          "focus:border-brand-500",
          hasError ? "border-red-400" : "border-slate-300 dark:border-slate-800",
          className,
        )}
        aria-invalid={hasError || undefined}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
