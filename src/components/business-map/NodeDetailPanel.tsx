"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Division } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";

const accentTone: Record<Division["accent"], "neon" | "teal" | "electric"> = {
  neon: "neon",
  teal: "teal",
  electric: "electric",
};

export function NodeDetailPanel({
  division,
  onClose,
}: {
  division: Division | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {division && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-20 bg-base-900/40 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="absolute right-0 top-0 z-30 flex h-full w-full max-w-sm flex-col gap-5 overflow-y-auto border-l border-white/10 bg-base-800/95 p-6 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <Badge tone={accentTone[division.accent]}>{division.tagline}</Badge>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {division.name}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Owner · <span className="text-slate-200">{division.owner}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <p className="label-eyebrow mb-3">Key KPIs</p>
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/5 bg-base-700/40 p-4">
                {division.kpis.map((kpi) => (
                  <Stat
                    key={kpi.label}
                    label={kpi.label}
                    value={kpi.value}
                    delta={kpi.delta}
                    trend={kpi.trend}
                    accent={division.accent}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="label-eyebrow mb-2">Active risks</p>
              <ul className="flex flex-col gap-2">
                {division.risks.map((risk) => (
                  <li
                    key={risk}
                    className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-slate-200"
                  >
                    <span className="mt-0.5 text-danger">▲</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="label-eyebrow mb-2">Active projects</p>
              <div className="flex flex-wrap gap-2">
                {division.activeProjects.map((p) => (
                  <Badge key={p} tone="muted">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
