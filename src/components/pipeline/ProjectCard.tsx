"use client";

import { motion } from "framer-motion";
import type { Project, ProjectStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

const statusTone: Record<ProjectStatus, "neon" | "warn" | "danger" | "muted"> = {
  "on-track": "neon",
  "at-risk": "warn",
  blocked: "danger",
  complete: "muted",
};

const statusLabel: Record<ProjectStatus, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  blocked: "Blocked",
  complete: "Operational",
};

export function ProjectCard({ project }: { project: Project }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
      className="group w-64 shrink-0 rounded-xl border border-white/5 bg-base-800/70 p-4 glass-hover"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{project.name}</p>
          <p className="text-[11px] text-slate-500">{project.client}</p>
        </div>
        <Badge tone={statusTone[project.status]}>{statusLabel[project.status]}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
        <div>
          <p className="label-eyebrow">Value</p>
          <p className="font-mono text-sm text-white">
            {formatCurrency(project.value, { compact: true })}
          </p>
        </div>
        <div>
          <p className="label-eyebrow">Capacity</p>
          <p className="font-mono text-sm text-teal">{project.mwp} MWp</p>
        </div>
        <div>
          <p className="label-eyebrow">Margin</p>
          <p className="font-mono text-sm text-neon">{project.margin}%</p>
        </div>
        <div>
          <p className="label-eyebrow">Probability</p>
          <p className="font-mono text-sm text-electric">{project.probability}%</p>
        </div>
      </div>

      {/* Probability bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-electric to-neon"
          style={{ width: `${project.probability}%` }}
        />
      </div>

      {project.blockers.length > 0 && (
        <div className="mt-3 rounded-lg border border-danger/20 bg-danger/5 px-2 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-danger">
            Blockers
          </p>
          <ul className="mt-0.5 list-inside list-disc text-[11px] text-slate-300">
            {project.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 border-t border-white/5 pt-2">
        <p className="label-eyebrow">Next action</p>
        <p className="text-[11px] text-slate-300">{project.nextAction}</p>
        <p className="mt-1 text-[10px] text-slate-500">Owner · {project.owner}</p>
      </div>
    </motion.div>
  );
}
