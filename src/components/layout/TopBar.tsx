"use client";

import { motion } from "framer-motion";
import { useViewMode } from "@/components/providers/ViewModeProvider";
import type { ViewMode } from "@/types";
import { NAV_ITEMS, SectionId } from "./Sidebar";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "executive", label: "Executive" },
  { id: "investor", label: "Investor" },
  { id: "client", label: "Client" },
  { id: "operations", label: "Operations" },
];

export function TopBar({
  active,
  onSelect,
  onExport,
  onToggleAI,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  onExport: () => void;
  onToggleAI: () => void;
}) {
  const { mode, setMode } = useViewMode();

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-base-900/80 backdrop-blur-xl">
      <div className="flex flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Live ticker / context strip */}
        <div className="flex items-center gap-3">
          <span className="lg:hidden text-sm font-semibold text-neon">Voltarc</span>
          <div className="hidden items-center gap-2 rounded-full border border-white/5 bg-base-800/60 px-3 py-1 sm:flex">
            <span className="h-2 w-2 animate-pulse-glow rounded-full bg-neon" />
            <span className="font-mono text-xs text-slate-300">
              NAV £1.1bn
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-xs text-teal">IRR 12.8%</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-xs text-electric">1.2 GWp</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Audience view toggle */}
          <div className="flex items-center rounded-full border border-white/5 bg-base-800/60 p-1">
            {VIEW_MODES.map((vm) => {
              const isActive = vm.id === mode;
              return (
                <button
                  key={vm.id}
                  onClick={() => setMode(vm.id)}
                  className={`relative rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    isActive ? "text-base-900" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="view-active"
                      className="absolute inset-0 rounded-full bg-neon shadow-glow"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{vm.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={onToggleAI}
            className="rounded-full border border-electric/30 bg-electric/10 px-3 py-1.5 text-xs font-medium text-electric transition-colors hover:bg-electric/20"
          >
            ✦ AI Insights
          </button>

          <button
            onClick={onExport}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
          >
            ⤓ Export Report
          </button>
        </div>
      </div>

      {/* Mobile section selector */}
      <div className="flex gap-1 overflow-x-auto border-t border-white/5 px-3 py-2 lg:hidden">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
              item.id === active
                ? "bg-neon/10 text-neon"
                : "text-slate-400"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
}
