"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Target,
  Calculator,
  GitCompareArrows,
  KanbanSquare,
  Map,
  ShieldAlert,
  Download,
  Sun,
} from "lucide-react";
import { ExecutiveDashboard } from "@/components/modules/ExecutiveDashboard";
import { SiteIntakeForm } from "@/components/modules/SiteIntakeForm";
import { ScoringPanel } from "@/components/modules/ScoringPanel";
import { FinancialPanel } from "@/components/modules/FinancialPanel";
import { ScenarioPanel } from "@/components/modules/ScenarioPanel";
import { PipelinePanel } from "@/components/modules/PipelinePanel";
import { MarketMap } from "@/components/modules/MarketMap";
import { RiskMatrixPanel } from "@/components/modules/RiskMatrixPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOpportunityStore } from "@/store/useOpportunityStore";
import { buildAssessmentExport, downloadAssessmentJson } from "@/services/exportService";
import { actionVariant } from "@/lib/display";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  { id: "intake", label: "Site Intake", icon: ClipboardList },
  { id: "scoring", label: "Scoring Engine", icon: Target },
  { id: "financial", label: "Financial Model", icon: Calculator },
  { id: "scenarios", label: "Scenario Engine", icon: GitCompareArrows },
  { id: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { id: "market", label: "Market Map", icon: Map },
  { id: "risk", label: "Risk Matrix", icon: ShieldAlert },
] as const;

type NavId = (typeof NAV)[number]["id"];

export function AppShell() {
  const [active, setActive] = useState<NavId>("dashboard");
  const { input, global, financial, scoring, scenarios, activeScenario } = useOpportunityStore();

  const handleExport = () => {
    const data = buildAssessmentExport(input, global, financial, scoring, scenarios);
    downloadAssessmentJson(data);
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="border-b border-border bg-card/40 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Sun className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Lightsummit</p>
            <p className="text-[10px] text-muted-foreground">Opportunity Engine</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:w-full",
                  active === item.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
          <div>
            <h1 className="text-base font-semibold">
              {NAV.find((n) => n.id === active)?.label}
            </h1>
            <p className="text-xs text-muted-foreground">
              {input.client.companyName} · {input.client.sector} · {input.client.country}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {activeScenario} case
            </Badge>
            <Badge variant={actionVariant(scoring.recommendedAction)}>
              {scoring.recommendedAction}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </header>

        <div className="p-6">
          {active === "dashboard" && <ExecutiveDashboard />}
          {active === "intake" && <SiteIntakeForm />}
          {active === "scoring" && <ScoringPanel />}
          {active === "financial" && <FinancialPanel />}
          {active === "scenarios" && <ScenarioPanel />}
          {active === "pipeline" && <PipelinePanel />}
          {active === "market" && <MarketMap />}
          {active === "risk" && <RiskMatrixPanel />}
        </div>
      </main>
    </div>
  );
}
