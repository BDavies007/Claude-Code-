import { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warn" | "danger";
  icon?: ReactNode;
}

const tones = {
  default: "text-fg",
  success: "text-success",
  warn: "text-warn",
  danger: "text-danger",
};

export function Stat({ label, value, hint, tone = "default", icon }: StatProps) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="flex items-center justify-between text-fg-muted">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        {icon && <span className="text-fg-muted">{icon}</span>}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight", tones[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  );
}
