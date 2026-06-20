"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { risks } from "@/data/risks";
import type { Risk, RiskCategory } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

const CATEGORIES: RiskCategory[] = [
  "Commercial",
  "Technical",
  "Contractual",
  "Grid",
  "Finance",
  "Credit",
  "Delivery",
  "Operations",
  "Market",
];

function scoreColor(score: number): string {
  if (score >= 16) return "bg-danger/80 text-white";
  if (score >= 10) return "bg-warn/80 text-base-900";
  if (score >= 5) return "bg-teal/70 text-base-900";
  return "bg-neon/70 text-base-900";
}

function cellColor(score: number): string {
  if (score >= 16) return "rgba(255,77,109,0.85)";
  if (score >= 10) return "rgba(255,180,84,0.8)";
  if (score >= 5) return "rgba(31,224,200,0.5)";
  return "rgba(57,255,139,0.35)";
}

export function RiskCockpit() {
  const [activeCategory, setActiveCategory] = useState<RiskCategory | "all">("all");

  const filtered = useMemo(
    () =>
      activeCategory === "all"
        ? risks
        : risks.filter((r) => r.category === activeCategory),
    [activeCategory]
  );

  // Build 5x5 matrix: rows = impact (5 top → 1 bottom), cols = likelihood 1→5
  const matrix = useMemo(() => {
    const grid: Record<string, Risk[]> = {};
    risks.forEach((r) => {
      const key = `${r.impact}-${r.likelihood}`;
      (grid[key] ??= []).push(r);
    });
    return grid;
  }, []);

  const topRisks = [...filtered].sort(
    (a, b) => b.impact * b.likelihood - a.impact * a.likelihood
  );

  return (
    <section>
      <SectionHeader
        eyebrow="Likelihood × Impact"
        title="Risk Cockpit"
        description="Nine risk categories scored 1–5 on likelihood and impact, with mitigation actions and accountable owners."
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Heat matrix */}
        <Panel className="p-5 lg:col-span-2">
          <p className="label-eyebrow mb-4">Heat matrix</p>
          <div className="flex">
            <div className="mr-2 flex flex-col justify-between py-1 text-[9px] uppercase tracking-wide text-slate-500">
              <span className="rotate-180 [writing-mode:vertical-rl]">Impact →</span>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-5 gap-1.5">
                {[5, 4, 3, 2, 1].map((impact) =>
                  [1, 2, 3, 4, 5].map((likelihood) => {
                    const score = impact * likelihood;
                    const cell = matrix[`${impact}-${likelihood}`] ?? [];
                    return (
                      <motion.div
                        key={`${impact}-${likelihood}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (impact + likelihood) * 0.02 }}
                        className="relative grid aspect-square place-items-center rounded-md text-xs font-semibold"
                        style={{ backgroundColor: cellColor(score) }}
                        title={`Impact ${impact} × Likelihood ${likelihood}`}
                      >
                        {cell.length > 0 && (
                          <span className="rounded-full bg-base-900/70 px-1.5 py-0.5 font-mono text-[11px] text-white">
                            {cell.length}
                          </span>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
              <div className="mt-2 text-center text-[9px] uppercase tracking-wide text-slate-500">
                Likelihood →
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-[10px]">
            <Badge tone="neon">Low</Badge>
            <Badge tone="teal">Moderate</Badge>
            <Badge tone="warn">Elevated</Badge>
            <Badge tone="danger">Critical</Badge>
          </div>
        </Panel>

        {/* Register */}
        <Panel index={1} className="p-5 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                activeCategory === "all"
                  ? "bg-neon/15 text-neon"
                  : "bg-white/5 text-slate-400"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  activeCategory === c
                    ? "bg-neon/15 text-neon"
                    : "bg-white/5 text-slate-400 hover:text-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {topRisks.map((r) => {
                const score = r.impact * r.likelihood;
                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className="rounded-xl border border-white/5 bg-base-700/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge tone="muted">{r.category}</Badge>
                          <span className="text-[10px] text-slate-500">
                            L{r.likelihood} · I{r.impact}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-white">{r.title}</p>
                      </div>
                      <div
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold ${scoreColor(score)}`}
                      >
                        {score}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      <span className="text-slate-500">Mitigation · </span>
                      {r.mitigation}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Owner · <span className="text-slate-300">{r.owner}</span>
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Panel>
      </div>
    </section>
  );
}
