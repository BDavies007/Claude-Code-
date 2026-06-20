"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar, SectionId } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { CommandCentre } from "@/components/ceo/CommandCentre";
import { BusinessMap } from "@/components/business-map/BusinessMap";
import { ProjectPipeline } from "@/components/pipeline/ProjectPipeline";
import { RevenueWaterfall } from "@/components/revenue/RevenueWaterfall";
import { RiskCockpit } from "@/components/risk/RiskCockpit";
import { ScenarioEngine } from "@/components/scenario/ScenarioEngine";
import { AIRecommendations } from "@/components/panels/AIRecommendations";
import { ExportToast } from "@/components/panels/ExportToast";

const SECTIONS: Record<SectionId, React.ReactNode> = {
  command: <CommandCentre />,
  map: <BusinessMap />,
  pipeline: <ProjectPipeline />,
  revenue: <RevenueWaterfall />,
  risk: <RiskCockpit />,
  scenario: <ScenarioEngine />,
};

export default function Home() {
  const [active, setActive] = useState<SectionId>("command");
  const [aiOpen, setAiOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => setExporting(false), 2600);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} onSelect={setActive} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          active={active}
          onSelect={setActive}
          onExport={handleExport}
          onToggleAI={() => setAiOpen(true)}
        />

        <main className="flex-1 px-5 py-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {SECTIONS[active]}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-white/5 px-5 py-4 text-center text-[11px] text-slate-600 lg:px-8">
          Voltarc Command Centre · Mock data · Built with Next.js · React · Tailwind ·
          Framer Motion · Recharts · React Flow
        </footer>
      </div>

      <AIRecommendations open={aiOpen} onClose={() => setAiOpen(false)} />
      <ExportToast show={exporting} />
    </div>
  );
}
