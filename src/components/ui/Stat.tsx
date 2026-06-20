"use client";

import { motion } from "framer-motion";
import type { TrendDirection } from "@/types";

const trendMeta: Record<TrendDirection, { glyph: string; cls: string }> = {
  up: { glyph: "▲", cls: "text-neon" },
  down: { glyph: "▼", cls: "text-danger" },
  flat: { glyph: "▬", cls: "text-slate-500" },
};

export function Stat({
  label,
  value,
  delta,
  trend,
  accent = "white",
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: TrendDirection;
  accent?: "white" | "neon" | "teal" | "electric";
}) {
  const accentCls =
    accent === "neon"
      ? "text-neon"
      : accent === "teal"
        ? "text-teal"
        : accent === "electric"
          ? "text-electric"
          : "text-white";

  return (
    <div className="flex flex-col gap-1">
      <span className="label-eyebrow">{label}</span>
      <motion.span
        key={value}
        initial={{ opacity: 0.4, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`font-mono text-xl font-semibold tracking-tight ${accentCls}`}
      >
        {value}
      </motion.span>
      {(delta || trend) && (
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          {trend && (
            <span className={trendMeta[trend].cls}>{trendMeta[trend].glyph}</span>
          )}
          {delta}
        </span>
      )}
    </div>
  );
}
