"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <div className="label-eyebrow flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-neon shadow-glow" />
          {eyebrow}
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
