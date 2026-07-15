import { type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-card border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400",
          "focus:border-brand-500",
          hasError ? "border-red-400" : "border-slate-300",
          className,
        )}
        aria-invalid={hasError || undefined}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
