/**
 * Domain model for the Lightsummit Opportunity Assessing Engine.
 *
 * These types describe a decentralised energy opportunity end-to-end: the
 * client and site intake, the technology and commercial assumptions, the
 * carbon/ESG layer, and the derived scoring and financial outputs.
 *
 * All monetary values are expressed in GBP unless otherwise noted. Energy
 * prices are expressed in £/kWh, capex in £/kWp or £/kWh as labelled.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type Sector =
  | "Logistics"
  | "Manufacturing"
  | "Data Centre"
  | "Retail"
  | "Commercial Office"
  | "Public Sector"
  | "Cold Storage"
  | "Industrial";

export type Country =
  | "United Kingdom"
  | "Germany"
  | "Netherlands"
  | "Poland"
  | "Spain"
  | "Italy"
  | "France"
  | "Ireland"
  | "Nordics";

export type CreditRating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "Unrated";

export type EsgUrgency = "Low" | "Moderate" | "High" | "Mandatory";

export type DecisionTimeline =
  | "<3 months"
  | "3-6 months"
  | "6-12 months"
  | "12+ months";

export type OwnershipStatus = "Owner-occupier" | "Long lease" | "Short lease" | "Multi-let";

export type SiteType =
  | "Warehouse / Distribution"
  | "Factory / Plant"
  | "Data Centre"
  | "Retail Park"
  | "Office Campus"
  | "Mixed Use"
  | "Public Building";

export type RoofCondition = "New / Excellent" | "Good" | "Fair" | "Poor / Requires works";

export type GridConnectionStatus =
  | "Strong import & export"
  | "Import only"
  | "Constrained export"
  | "Heavily constrained"
  | "Connection required";

export type ContractRisk = "Low" | "Medium" | "High";

export type RecommendedAction =
  | "Reject"
  | "Watchlist"
  | "Feasibility"
  | "Priority"
  | "Strategic Flagship";

export type PipelineStage =
  | "Lead"
  | "Qualified"
  | "Desktop Assessment"
  | "Feasibility"
  | "Commercial Structuring"
  | "Investment Committee"
  | "Contracting"
  | "Build"
  | "Operational";

export type ScenarioKey =
  | "base"
  | "conservative"
  | "downside"
  | "upside"
  | "aggressive"
  | "custom";

// ---------------------------------------------------------------------------
// Site intake
// ---------------------------------------------------------------------------

export interface ClientDetails {
  companyName: string;
  sector: Sector;
  country: Country;
  creditRating: CreditRating;
  esgUrgency: EsgUrgency;
  decisionTimeline: DecisionTimeline;
  ownershipStatus: OwnershipStatus;
}

export interface SiteDetails {
  region: string;
  siteType: SiteType;
  roofAreaM2: number;
  roofCondition: RoofCondition;
  availableLandHa: number;
  gridConnection: GridConnectionStatus;
  annualConsumptionMWh: number;
  peakDemandMW: number;
  operatingHoursPerDay: number;
  evFleetPotential: boolean;
  highIntensityLoad: boolean; // data centre / HVAC / cold storage
}

export interface CommercialDetails {
  currentGridPrice: number; // £/kWh
  gridPriceEscalation: number; // fraction per year, e.g. 0.04
  ppaTargetPrice: number; // £/kWh
  ppaTermYears: number;
  takeOrPayPct: number; // fraction, e.g. 0.85
  inflationIndexation: number; // fraction per year
  clientSavingsTargetPct: number; // fraction, e.g. 0.15
  contractRisk: ContractRisk;
}

export interface TechnologyAssumptions {
  solarMwp: number;
  batteryPowerMW: number;
  batteryEnergyMWh: number;
  evChargers: number;
  bemsRequired: boolean;
  flexibilityEligible: boolean;
  exportConstrained: boolean;
  capexPerKwp: number; // £/kWp
  bessCostPerKwh: number; // £/kWh
  omCostPerKwpYear: number; // £/kWp/year
  performanceRatio: number; // fraction, e.g. 0.85
  degradationRate: number; // fraction per year, e.g. 0.0045
}

export interface CarbonEsgDetails {
  gridEmissionsFactor: number; // tCO2 per MWh
  carbonPrice: number; // £/tCO2
  carbonPriceGrowth: number; // fraction per year
  mrvRequired: boolean;
  scopeRelevance: ("Scope 1" | "Scope 2" | "Scope 3")[];
  esgReportingPressure: EsgUrgency;
  supplierTransparencyNeed: boolean;
  biodiversityCircularity: boolean;
}

export interface OpportunityInput {
  id: string;
  client: ClientDetails;
  site: SiteDetails;
  commercial: CommercialDetails;
  technology: TechnologyAssumptions;
  carbon: CarbonEsgDetails;
}

// ---------------------------------------------------------------------------
// Financial model
// ---------------------------------------------------------------------------

export interface GlobalAssumptions {
  discountRate: number; // fraction
  inflation: number; // fraction
  developerMarginPerKwh: number; // £/kWh
  debtRatio: number; // fraction of capex funded by debt
  debtCostRate: number; // fraction interest rate
  debtTermYears: number;
}

export interface YearlyCashFlow {
  year: number;
  generationMWh: number;
  ppaRevenue: number;
  clientSavings: number;
  developerMargin: number;
  carbonValue: number;
  bessArbitrage: number;
  flexibilityRevenue: number;
  exportRevenue: number;
  grossRevenue: number;
  opex: number;
  debtService: number;
  ebitda: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  dscr: number;
}

export interface FinancialResult {
  capex: number;
  cashFlows: YearlyCashFlow[];
  npv: number;
  riskAdjustedNpv: number;
  irr: number;
  paybackYears: number;
  minDscr: number;
  avgDscr: number;
  totalRevenue25yr: number;
  clientBenefitPerYear: number;
  lightsummitRecurringMargin: number; // annual developer margin
  totalCarbonTonnes: number;
  totalCarbonValue: number;
  lifetimeGenerationMWh: number;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ScoreCategory {
  key: string;
  label: string;
  weight: number; // fraction of overall, sums to 1
  score: number; // 0-100
  subScores: { label: string; score: number; note?: string }[];
}

export interface ScoringResult {
  overall: number; // 0-100
  categories: ScoreCategory[];
  recommendedAction: RecommendedAction;
  financialAttractiveness: number; // 0-100
  carbonImpact: number; // 0-100
  gridFlexibilityValue: number; // 0-100
  riskScore: number; // 0-100, higher = riskier
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export interface ScenarioModifiers {
  key: ScenarioKey;
  label: string;
  description: string;
  gridPriceMult: number;
  ppaPriceMult: number;
  capexMult: number;
  bessCostMult: number;
  carbonPriceMult: number;
  loadMult: number;
  exportPriceMult: number;
  debtCostMult: number;
  riskMult: number; // applied to discount premium
  constructionDelayMonths: number;
  curtailmentPct: number; // fraction of generation lost
}

export interface ScenarioResult {
  scenario: ScenarioModifiers;
  financial: FinancialResult;
  scoring: ScoringResult;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface PipelineEntry {
  id: string;
  leadName: string;
  sector: Sector;
  country: Country;
  mwpPotential: number;
  bessPotentialMWh: number;
  annualSavings: number;
  carbonTonnesSaved: number;
  opportunityScore: number;
  irr: number;
  stage: PipelineStage;
  nextAction: string;
  recommendedAction: RecommendedAction;
}

// ---------------------------------------------------------------------------
// Market map
// ---------------------------------------------------------------------------

export interface MarketProfile {
  country: Country;
  marketAttractiveness: number; // 0-100
  gridConstraintSeverity: number; // 0-100
  ppaMaturity: number; // 0-100
  carbonEsgPressure: number; // 0-100
  bessOpportunity: number; // 0-100
  regulatoryComplexity: number; // 0-100
  entryStrategy: string;
}

// ---------------------------------------------------------------------------
// Risk matrix
// ---------------------------------------------------------------------------

export interface RiskItem {
  id: string;
  category: string;
  risk: string;
  likelihood: number; // 1-5
  impact: number; // 1-5
  mitigation: string;
}
