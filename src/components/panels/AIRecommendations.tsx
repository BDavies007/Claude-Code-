"use client";

import { AnimatePresence, motion } from "framer-motion";
import { aiRecommendations } from "@/data/ceo";
import type { Priority } from "@/types";
import { Badge } from "@/components/ui/Badge";

const impactTone: Record<Priority, "danger" | "warn" | "teal"> = {
  critical: "danger",
  high: "warn",
  medium: "teal",
};

export function AIRecommendations({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-base-900/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-electric/20 bg-base-800/95 p-6 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg text-electric">✦</span>
                  <h3 className="text-lg font-semibold text-white">
                    AI Recommendations
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Generated insights · placeholder for live model integration
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-electric/20 bg-electric/5 p-3 text-xs text-slate-300">
              <span className="font-semibold text-electric">Note · </span>
              Wire this panel to your LLM / analytics service. Each card maps to a
              recommendation object in <code className="text-slate-200">src/data/ceo.ts</code>.
            </div>

            <div className="flex flex-col gap-3">
              {aiRecommendations.map((rec, i) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl border border-white/5 bg-base-700/40 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{rec.title}</p>
                    <Badge tone={impactTone[rec.impact]}>{rec.impact}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{rec.rationale}</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Confidence</span>
                      <span className="font-mono text-electric">
                        {rec.confidence}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${rec.confidence}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08 }}
                        className="h-full rounded-full bg-gradient-to-r from-electric to-teal"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="rounded-lg bg-electric/15 px-3 py-1 text-[11px] font-medium text-electric hover:bg-electric/25">
                      Accept
                    </button>
                    <button className="rounded-lg bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/10">
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
