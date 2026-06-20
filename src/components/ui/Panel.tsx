"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Stagger index for entrance animation */
  index?: number;
  grid?: boolean;
}

export function Panel({ children, className = "", index = 0, grid }: PanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
      className={`panel ${grid ? "panel-grid" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}
