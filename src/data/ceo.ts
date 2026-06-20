import type {
  AIRecommendation,
  Alert,
  Decision,
  InvestorMetric,
  Opportunity,
  TeamAction,
} from "@/types";

export const criticalDecisions: Decision[] = [
  {
    id: "d1",
    title: "Approve Aurora Fields debt term sheet",
    context: "£28.5m project; DSCR sensitivity needs sign-off before CC.",
    priority: "critical",
    due: "24 Jun",
    owner: "L. Romano",
  },
  {
    id: "d2",
    title: "Commit alt. module supplier for Pennine",
    context: "6-week slip risks Q4 energisation milestone.",
    priority: "high",
    due: "26 Jun",
    owner: "M. Okafor",
  },
  {
    id: "d3",
    title: "Greenlight Severn Estuary land option",
    context: "80 MWp site; option expires end of month.",
    priority: "high",
    due: "30 Jun",
    owner: "S. Patel",
  },
];

export const blockedProjects: { id: string; name: string; reason: string; value: number }[] = [
  { id: "p5", name: "Northwind Roof", reason: "Landlord consent stalled", value: 9_400_000 },
  { id: "p6", name: "Pennine Solar", reason: "Module delivery slip", value: 22_100_000 },
  { id: "p11", name: "Anglia Agri-PV", reason: "Yield assumptions", value: 11_600_000 },
];

export const opportunities: Opportunity[] = [
  { id: "o1", title: "Caledonia Hub", value: 70_000_000, probability: 25, mwp: 110 },
  { id: "o2", title: "Severn Estuary", value: 55_000_000, probability: 35, mwp: 80 },
  { id: "o3", title: "Mersey Storage", value: 31_000_000, probability: 75, mwp: 50 },
];

export const alerts: Alert[] = [
  { id: "a1", message: "Grid queue reform consultation closes in 5 days", severity: "critical", source: "Grid" },
  { id: "a2", message: "Inverter cluster fault — 3 sites flagged", severity: "high", source: "O&M" },
  { id: "a3", message: "Carbon price up 9% w/w — credit value uplift", severity: "medium", source: "Carbon" },
];

export const teamActions: TeamAction[] = [
  { id: "t1", owner: "L. Romano", action: "Finalise Aurora credit pack", due: "23 Jun", status: "in-progress" },
  { id: "t2", owner: "M. Okafor", action: "Lock module allocation", due: "25 Jun", status: "todo" },
  { id: "t3", owner: "K. Suzuki", action: "Drake grid witness test", due: "27 Jun", status: "in-progress" },
  { id: "t4", owner: "D. Clarke", action: "Escalate Northwind consent", due: "24 Jun", status: "todo" },
  { id: "t5", owner: "R. Bianchi", action: "Inverter retrofit schedule", due: "01 Jul", status: "done" },
];

export const investorMetrics: InvestorMetric[] = [
  { label: "Portfolio NAV", value: "£1.1bn", sub: "+14% YoY", trend: "up" },
  { label: "Contracted revenue", value: "£186m", sub: "8.3 yr avg life", trend: "up" },
  { label: "Equity IRR", value: "12.8%", sub: "gross, levered", trend: "flat" },
  { label: "Capacity owned", value: "640 MWp", sub: "+90 MWp YTD", trend: "up" },
  { label: "Pipeline", value: "1.2 GWp", sub: "risk-adjusted 380 MWp", trend: "up" },
  { label: "Fleet availability", value: "98.6%", sub: "vs 98.0% target", trend: "up" },
];

export const aiRecommendations: AIRecommendation[] = [
  {
    id: "ai1",
    title: "Accelerate Aurora financial close",
    rationale:
      "Lender appetite is strong this week; rate hedge window favourable. Closing now protects 13.1% margin vs 0.4% drift if slipped to Q3.",
    confidence: 86,
    impact: "critical",
  },
  {
    id: "ai2",
    title: "Reallocate BESS dispatch to evening peak",
    rationale:
      "Imbalance spreads widening 18:00–20:00. Shifting Drake dispatch could add ~£0.6m/yr at current capture.",
    confidence: 78,
    impact: "high",
  },
  {
    id: "ai3",
    title: "Bundle carbon credits into corporate PPAs",
    rationale:
      "3 clients screened as high-fit for bundled ESG offtake; lifts blended PPA price ~£6/MWh.",
    confidence: 71,
    impact: "medium",
  },
];
