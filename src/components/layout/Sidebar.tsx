"use client";

import { motion } from "framer-motion";

export type SectionId =
  | "command"
  | "map"
  | "pipeline"
  | "revenue"
  | "risk"
  | "scenario";

export interface NavItem {
  id: SectionId;
  label: string;
  hint: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "command", label: "Command Centre", hint: "CEO cockpit", icon: "◎" },
  { id: "map", label: "Business Map", hint: "Strategy → execution", icon: "⬡" },
  { id: "pipeline", label: "Pipeline", hint: "Lead → operation", icon: "▦" },
  { id: "revenue", label: "Revenue", hint: "Waterfall & scenarios", icon: "▤" },
  { id: "risk", label: "Risk Cockpit", hint: "Heat & mitigation", icon: "◭" },
  { id: "scenario", label: "Scenario Engine", hint: "Live financials", icon: "∿" },
];

export function Sidebar({
  active,
  onSelect,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-base-800/50 px-4 py-6 lg:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-neon/30 to-electric/20 shadow-glow">
          <span className="text-lg font-bold text-neon">V</span>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">
            Voltarc
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Command Centre
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-neon/20 bg-neon/5"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span
                className={`relative z-10 text-base ${
                  isActive ? "text-neon" : "text-slate-500 group-hover:text-slate-300"
                }`}
              >
                {item.icon}
              </span>
              <span className="relative z-10 flex flex-col">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-[10px] text-slate-500">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-6 rounded-xl border border-white/5 bg-base-700/40 p-3">
        <p className="label-eyebrow">System status</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse-glow rounded-full bg-neon shadow-glow" />
          <span className="text-xs text-slate-300">All feeds live</span>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Mock data source</p>
      </div>
    </aside>
  );
}
