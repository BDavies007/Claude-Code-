"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ViewMode } from "@/types";

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

/**
 * Holds the active audience lens (Executive / Investor / Client / Operations).
 * Sections read this to tailor emphasis without duplicating data.
 */
export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ViewMode>("executive");
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
