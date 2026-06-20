import { ReactNode } from "react";

type BadgeTone =
  | "neon"
  | "teal"
  | "electric"
  | "danger"
  | "warn"
  | "muted";

const tones: Record<BadgeTone, string> = {
  neon: "border-neon/30 bg-neon/10 text-neon",
  teal: "border-teal/30 bg-teal/10 text-teal",
  electric: "border-electric/30 bg-electric/10 text-electric",
  danger: "border-danger/30 bg-danger/10 text-danger",
  warn: "border-warn/30 bg-warn/10 text-warn",
  muted: "border-white/10 bg-white/5 text-slate-400",
};

export function Badge({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
