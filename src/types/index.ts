// =============================================================================
// Core domain types for the Clean-Tech Command Centre.
// These mirror the eventual database schema so mock data can be swapped for a
// real data source (see src/data/*) without touching component code.
// =============================================================================

export type ViewMode = "executive" | "investor" | "client" | "operations";

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export type TrendDirection = "up" | "down" | "flat";

// --- Business Map -----------------------------------------------------------

export type DivisionId =
  | "development"
  | "epc"
  | "finance"
  | "spvs"
  | "asset-ownership"
  | "om"
  | "energy-trading"
  | "carbon"
  | "client-reporting";

export interface DivisionKpi {
  label: string;
  value: string;
  trend?: TrendDirection;
  delta?: string;
}

export interface Division {
  id: DivisionId;
  name: string;
  tagline: string;
  /** Tailwind accent token: neon | teal | electric */
  accent: "neon" | "teal" | "electric";
  owner: string;
  health: number; // 0-100
  kpis: DivisionKpi[];
  risks: string[];
  activeProjects: string[];
  /** React Flow canvas position */
  position: { x: number; y: number };
}

export interface DivisionFlow {
  id: string;
  source: DivisionId;
  target: DivisionId;
  label?: string;
}

// --- Project Pipeline -------------------------------------------------------

export const PIPELINE_STAGES = [
  "Lead",
  "Qualification",
  "Site Survey",
  "Design",
  "Finance",
  "Contract",
  "Procurement",
  "Build",
  "Commissioning",
  "Operation",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type ProjectStatus = "on-track" | "at-risk" | "blocked" | "complete";

export interface Project {
  id: string;
  name: string;
  client: string;
  stage: PipelineStage;
  status: ProjectStatus;
  value: number; // £
  mwp: number; // MW peak
  margin: number; // %
  probability: number; // 0-100 weighted close
  blockers: string[];
  nextAction: string;
  owner: string;
}

// --- Revenue Waterfall ------------------------------------------------------

export type RevenueStreamId =
  | "developer-fees"
  | "epc-margin"
  | "om"
  | "asset-management"
  | "ppa-income"
  | "battery-optimisation"
  | "energy-trading"
  | "carbon-credits";

export interface RevenueStream {
  id: RevenueStreamId;
  label: string;
  /** Per-scenario contribution in £m */
  values: Record<ScenarioKey, number>;
  accent: "neon" | "teal" | "electric";
}

export type ScenarioKey = "base" | "upside" | "downside";

export interface RevenueScenario {
  key: ScenarioKey;
  label: string;
  description: string;
}

// --- Risk Cockpit -----------------------------------------------------------

export type RiskCategory =
  | "Commercial"
  | "Technical"
  | "Contractual"
  | "Grid"
  | "Finance"
  | "Credit"
  | "Delivery"
  | "Operations"
  | "Market";

export interface Risk {
  id: string;
  category: RiskCategory;
  title: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  mitigation: string;
  owner: string;
  trend: TrendDirection;
}

// --- Financial Scenario Engine ---------------------------------------------

export interface ScenarioInputs {
  ppaPrice: number; // £/MWh
  gridPrice: number; // £/MWh
  capexPerKwp: number; // £/kWp
  systemSizeKwp: number; // kWp
  batterySizeKwh: number; // kWh
  debtPct: number; // %
  interestRate: number; // %
  carbonPrice: number; // £/tCO2
  inflation: number; // %
  omCostPerKwp: number; // £/kWp/yr
}

export interface ScenarioOutputs {
  irr: number; // %
  npv: number; // £
  ebitda: number; // £/yr
  clientSavings: number; // £/yr
  payback: number; // yrs
  carbonValue: number; // £/yr
  equityReturn: number; // x multiple
}

export interface CashflowPoint {
  year: number;
  cashflow: number;
  cumulative: number;
}

// --- CEO Command Centre -----------------------------------------------------

export type Priority = "critical" | "high" | "medium";

export interface Decision {
  id: string;
  title: string;
  context: string;
  priority: Priority;
  due: string;
  owner: string;
}

export interface Opportunity {
  id: string;
  title: string;
  value: number;
  probability: number;
  mwp: number;
}

export interface Alert {
  id: string;
  message: string;
  severity: Priority;
  source: string;
}

export interface TeamAction {
  id: string;
  owner: string;
  action: string;
  due: string;
  status: "todo" | "in-progress" | "done";
}

export interface InvestorMetric {
  label: string;
  value: string;
  sub: string;
  trend: TrendDirection;
}

export interface AIRecommendation {
  id: string;
  title: string;
  rationale: string;
  confidence: number; // 0-100
  impact: Priority;
}
