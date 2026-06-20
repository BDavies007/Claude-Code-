"use client";

import { AnimatePresence, motion } from "framer-motion";

/**
 * Placeholder export affordance. A real implementation would render a PDF /
 * board pack server-side; here we surface a confirmation toast so the flow is
 * wired end-to-end in the UI.
 */
export function ExportToast({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-neon/30 bg-base-800/95 px-5 py-3 shadow-glow backdrop-blur"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-neon/15 text-neon">
              ⤓
            </span>
            <div>
              <p className="text-sm font-medium text-white">
                Board report queued
              </p>
              <p className="text-[11px] text-slate-400">
                Export placeholder — connect to your reporting service.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
