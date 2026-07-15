import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export type AlertVariant = "info" | "success" | "warning" | "error";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  info: "bg-blue-50 text-blue-800 border-blue-200",
  success: "bg-green-50 text-green-800 border-green-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  error: "bg-red-50 text-red-800 border-red-200",
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

export function Alert({ className, variant = "info", role, ...props }: AlertProps) {
  return (
    <div
      role={role ?? (variant === "error" ? "alert" : "status")}
      className={cn("rounded-card border px-4 py-3 text-sm", VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
