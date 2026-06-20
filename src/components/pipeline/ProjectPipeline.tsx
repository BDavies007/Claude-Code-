"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PIPELINE_STAGES, type PipelineStage } from "@/types";
import { projects } from "@/data/projects";
import { ProjectCard } from "./ProjectCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Panel } from "@/components/ui/Panel";
import { formatCurrency } from "@/lib/format";

export function ProjectPipeline() {
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");

  const filtered = useMemo(() => {
    if (filter === "active")
      return projects.filter((p) => p.status !== "complete");
    if (filter === "blocked")
      return projects.filter((p) => p.blockers.length > 0);
    return projects;
  }, [filter]);

  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, typeof projects>();
    PIPELINE_STAGES.forEach((s) => map.set(s, []));
    filtered.forEach((p) => map.get(p.stage)!.push(p));
    return map;
  }, [filtered]);

  const totals = useMemo(() => {
    const value = filtered.reduce((a, p) => a + p.value, 0);
    const mwp = filtered.reduce((a, p) => a + p.mwp, 0);
    const weighted = filtered.reduce(
      (a, p) => a + (p.value * p.probability) / 100,
      0
    );
    return { value, mwp, weighted, count: filtered.length };
  }, [filtered]);

  const filters: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "blocked", label: "Blocked" },
  ];

  return (
    <section>
      <SectionHeader
        eyebrow="Lead → Operation"
        title="Project Pipeline"
        description="Every project tracked across ten delivery stages with value, capacity, margin, probability, blockers and the next action."
        actions={
          <div className="flex items-center rounded-full border border-white/5 bg-base-800/60 p-1">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`relative rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.id ? "text-base-900" : "text-slate-400"
                }`}
              >
                {filter === f.id && (
                  <motion.div
                    layoutId="pipeline-filter"
                    className="absolute inset-0 rounded-full bg-teal"
                  />
                )}
                <span className="relative z-10">{f.label}</span>
              </button>
            ))}
          </div>
        }
      />

      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pipeline value", value: formatCurrency(totals.value, { compact: true }), accent: "text-white" },
          { label: "Risk-weighted", value: formatCurrency(totals.weighted, { compact: true }), accent: "text-neon" },
          { label: "Capacity", value: `${totals.mwp} MWp`, accent: "text-teal" },
          { label: "Projects", value: `${totals.count}`, accent: "text-electric" },
        ].map((s, i) => (
          <Panel key={s.label} index={i} className="p-4">
            <p className="label-eyebrow">{s.label}</p>
            <p className={`mt-1 font-mono text-xl font-semibold ${s.accent}`}>
              {s.value}
            </p>
          </Panel>
        ))}
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4">
          {PIPELINE_STAGES.map((stage, i) => {
            const items = byStage.get(stage)!;
            const stageValue = items.reduce((a, p) => a + p.value, 0);
            return (
              <motion.div
                key={stage}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex w-64 shrink-0 flex-col"
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-600">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                      {stage}
                    </h3>
                  </div>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                    {items.length}
                  </span>
                </div>
                {stageValue > 0 && (
                  <p className="mb-2 px-1 font-mono text-[10px] text-slate-500">
                    {formatCurrency(stageValue, { compact: true })}
                  </p>
                )}
                <div className="flex min-h-[120px] flex-col gap-3 rounded-xl border border-white/5 bg-base-900/40 p-2">
                  {items.length === 0 ? (
                    <div className="grid flex-1 place-items-center py-8 text-[11px] text-slate-600">
                      —
                    </div>
                  ) : (
                    items.map((p) => <ProjectCard key={p.id} project={p} />)
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
