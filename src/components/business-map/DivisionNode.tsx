"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { motion } from "framer-motion";
import type { Division } from "@/types";

const accentRing: Record<Division["accent"], string> = {
  neon: "border-neon/40 shadow-glow",
  teal: "border-teal/40 shadow-glow-teal",
  electric: "border-electric/40 shadow-glow-blue",
};

const accentText: Record<Division["accent"], string> = {
  neon: "text-neon",
  teal: "text-teal",
  electric: "text-electric",
};

const accentBar: Record<Division["accent"], string> = {
  neon: "bg-neon",
  teal: "bg-teal",
  electric: "bg-electric",
};

export interface DivisionNodeData {
  division: Division;
  selected: boolean;
}

export function DivisionNode({ data }: NodeProps<DivisionNodeData>) {
  const { division, selected } = data;
  const headline = division.kpis[0];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3 }}
      className={`w-48 cursor-pointer rounded-xl border bg-base-800/90 p-3 backdrop-blur transition-all ${
        selected ? accentRing[division.accent] : "border-white/10"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-slate-600"
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{division.name}</p>
          <p className="text-[10px] text-slate-500">{division.tagline}</p>
        </div>
        <span
          className={`h-2 w-2 animate-pulse-glow rounded-full ${accentBar[division.accent]}`}
        />
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="label-eyebrow">{headline.label}</p>
          <p className={`font-mono text-sm font-semibold ${accentText[division.accent]}`}>
            {headline.value}
          </p>
        </div>
        <div className="text-right">
          <p className="label-eyebrow">Health</p>
          <p className="font-mono text-sm font-semibold text-white">
            {division.health}
          </p>
        </div>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${accentBar[division.accent]}`}
          style={{ width: `${division.health}%` }}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-slate-600"
      />
    </motion.div>
  );
}
