import { cn } from "@/lib/utils/cn";

export interface LoadingProps {
  label?: string;
  className?: string;
}

export function Loading({ label = "Carregando...", className }: LoadingProps) {
  return (
    <div className={cn("flex items-center justify-center gap-3 py-10 text-slate-500", className)}>
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
        aria-hidden="true"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
