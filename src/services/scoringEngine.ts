/**
 * Opportunity scoring engine.
 *
 * Produces a weighted 0-100 opportunity score across seven categories, each
 * built from transparent sub-scores. The category weights follow the model
 * brief:
 *
 *   Energy economics ........ 25%
 *   Site technical viability  15%
 *   Contractability ......... 15%
 *   Carbon / ESG value ...... 15%
 *   Flexibility / grid value  10%
 *   Strategic sector value .. 10%
 *   Financeability .......... 10%
 *
 * The scoring is deliberately rule-based and explainable so commercial teams
 * can interrogate why a site scored the way it did.
 */

import type {
  OpportunityInput,
  ScoringResult,
  ScoreCategory,
  RecommendedAction,
  CreditRating,
  Sector,
} from "@/types";
import { clamp } from "@/lib/utils";

const CREDIT_SCORE: Record<CreditRating, number> = {
  AAA: 100,
  AA: 92,
  A: 82,
  BBB: 70,
  BB: 50,
  B: 32,
  Unrated: 20,
};

const STRATEGIC_SECTORS: Record<Sector, number> = {
  "Data Centre": 100,
  Logistics: 90,
  Manufacturing: 85,
  "Cold Storage": 80,
  Industrial: 75,
  Retail: 65,
  "Commercial Office": 55,
  "Public Sector": 60,
};

function score0to100(value: number, lo: number, hi: number): number {
  if (hi === lo) return 50;
  return clamp(((value - lo) / (hi - lo)) * 100, 0, 100);
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

// ---------------------------------------------------------------------------
// Category scorers
// ---------------------------------------------------------------------------

function scoreEnergyEconomics(input: OpportunityInput): ScoreCategory {
  const { site, commercial } = input;

  const consumptionScore = score0to100(site.annualConsumptionMWh, 500, 50000);
  const gridPriceScore = score0to100(commercial.currentGridPrice, 0.12, 0.35);
  const spread = commercial.currentGridPrice - commercial.ppaTargetPrice;
  const spreadScore = score0to100(spread, 0, 0.12);
  const escalationScore = score0to100(commercial.gridPriceEscalation, 0.0, 0.08);

  const subScores = [
    { label: "Energy consumption", score: consumptionScore },
    { label: "Grid price level", score: gridPriceScore },
    { label: "PPA vs grid spread", score: spreadScore },
    { label: "Price escalation outlook", score: escalationScore },
  ];

  return {
    key: "energy",
    label: "Energy economics",
    weight: 0.25,
    score: avg(subScores.map((s) => s.score)),
    subScores,
  };
}

function scoreSiteViability(input: OpportunityInput): ScoreCategory {
  const { site } = input;

  // Roof area drives solar potential; ~10m2/kWp so 30,000m2 ~ 3MWp.
  const roofScore = score0to100(site.roofAreaM2, 1000, 40000);
  const landScore = score0to100(site.availableLandHa, 0, 10);
  const roofConditionScore =
    site.roofCondition === "New / Excellent"
      ? 100
      : site.roofCondition === "Good"
      ? 80
      : site.roofCondition === "Fair"
      ? 50
      : 15;
  const gridScore =
    site.gridConnection === "Strong import & export"
      ? 100
      : site.gridConnection === "Import only"
      ? 75
      : site.gridConnection === "Constrained export"
      ? 60
      : site.gridConnection === "Heavily constrained"
      ? 35
      : 20;

  const subScores = [
    { label: "Roof area", score: roofScore },
    { label: "Available land", score: landScore },
    { label: "Roof condition", score: roofConditionScore },
    { label: "Grid connection", score: gridScore },
  ];

  return {
    key: "site",
    label: "Site technical viability",
    weight: 0.15,
    score: avg(subScores.map((s) => s.score)),
    subScores,
  };
}

function scoreContractability(input: OpportunityInput): ScoreCategory {
  const { client, commercial } = input;

  const creditScore = CREDIT_SCORE[client.creditRating];
  const tenureScore =
    client.ownershipStatus === "Owner-occupier"
      ? 100
      : client.ownershipStatus === "Long lease"
      ? 85
      : client.ownershipStatus === "Multi-let"
      ? 45
      : 25;
  const takeOrPayScore = score0to100(commercial.takeOrPayPct, 0.5, 1.0);
  const termScore = score0to100(commercial.ppaTermYears, 5, 25);
  const riskPenalty =
    commercial.contractRisk === "Low"
      ? 100
      : commercial.contractRisk === "Medium"
      ? 65
      : 30;

  const subScores = [
    { label: "Offtaker credit", score: creditScore },
    { label: "Tenure / ownership", score: tenureScore },
    { label: "Take-or-pay level", score: takeOrPayScore },
    { label: "PPA term", score: termScore },
    { label: "Contract risk", score: riskPenalty },
  ];

  return {
    key: "contract",
    label: "Contractability",
    weight: 0.15,
    score: avg(subScores.map((s) => s.score)),
    subScores,
  };
}

function scoreCarbonEsg(input: OpportunityInput): ScoreCategory {
  const { carbon, client } = input;

  const esgUrgencyScore =
    client.esgUrgency === "Mandatory"
      ? 100
      : client.esgUrgency === "High"
      ? 80
      : client.esgUrgency === "Moderate"
      ? 50
      : 25;
  const carbonPriceScore = score0to100(carbon.carbonPrice, 30, 150);
  const mrvScore = carbon.mrvRequired ? 100 : 40;
  const scopeScore = score0to100(carbon.scopeRelevance.length, 0, 3);
  const transparencyScore =
    (carbon.supplierTransparencyNeed ? 50 : 0) +
    (carbon.biodiversityCircularity ? 50 : 0);

  const subScores = [
    { label: "ESG / CSRD urgency", score: esgUrgencyScore },
    { label: "Carbon price level", score: carbonPriceScore },
    { label: "MRV requirement", score: mrvScore },
    { label: "Scope 1/2/3 relevance", score: scopeScore },
    { label: "Supply-chain transparency", score: transparencyScore },
  ];

  return {
    key: "carbon",
    label: "Carbon / ESG value",
    weight: 0.15,
    score: avg(subScores.map((s) => s.score)),
    subScores,
  };
}

function scoreFlexibility(input: OpportunityInput): ScoreCategory {
  const { technology, site } = input;

  const bessScore = score0to100(technology.batteryEnergyMWh, 0, 20);
  const constraintScore =
    site.gridConnection === "Heavily constrained"
      ? 100
      : site.gridConnection === "Constrained export"
      ? 80
      : site.gridConnection === "Import only"
      ? 50
      : 30;
  const eligibilityScore = technology.flexibilityEligible ? 100 : 30;
  const loadFlexScore =
    (site.highIntensityLoad ? 60 : 20) + (site.evFleetPotential ? 40 : 0);

  const subScores = [
    { label: "BESS scale", score: bessScore },
    { label: "Grid constraint (flex upside)", score: constraintScore },
    { label: "Flexibility eligibility", score: eligibilityScore },
    { label: "Flexible / EV load", score: clamp(loadFlexScore, 0, 100) },
  ];

  return {
    key: "flex",
    label: "Flexibility / grid value",
    weight: 0.1,
    score: avg(subScores.map((s) => s.score)),
    subScores,
  };
}

function scoreStrategicSector(input: OpportunityInput): ScoreCategory {
  const { client } = input;
  const sectorScore = STRATEGIC_SECTORS[client.sector];
  const timelineScore =
    client.decisionTimeline === "<3 months"
      ? 100
      : client.decisionTimeline === "3-6 months"
      ? 80
      : client.decisionTimeline === "6-12 months"
      ? 55
      : 30;

  const subScores = [
    { label: "Strategic sector fit", score: sectorScore },
    { label: "Decision timeline", score: timelineScore },
  ];

  return {
    key: "strategic",
    label: "Strategic sector value",
    weight: 0.1,
    score: avg(subScores.map((s) => s.score)),
    subScores,
  };
}

function scoreFinanceability(
  input: OpportunityInput,
  irrValue: number,
  minDscr: number
): ScoreCategory {
  const irrScore = isFinite(irrValue) ? score0to100(irrValue, 0.06, 0.25) : 30;
  const dscrScore = isFinite(minDscr) ? score0to100(minDscr, 1.0, 2.0) : 50;
  const creditScore = CREDIT_SCORE[input.client.creditRating];

  const subScores = [
    { label: "Project IRR", score: irrScore },
    { label: "Min DSCR", score: dscrScore },
    { label: "Counterparty credit", score: creditScore },
  ];

  return {
    key: "finance",
    label: "Financeability",
    weight: 0.1,
    score: avg(subScores.map((s) => s.score)),
    subScores,
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Map an overall score to a recommended action. */
export function recommendAction(overall: number, riskScore: number): RecommendedAction {
  if (overall < 35) return "Reject";
  if (overall < 50) return "Watchlist";
  if (overall < 65) return "Feasibility";
  if (overall < 80) return "Priority";
  // Strategic flagship requires a strong score and contained risk.
  return riskScore < 55 ? "Strategic Flagship" : "Priority";
}

/**
 * Compute the full scoring result for an opportunity.
 *
 * `irrValue` and `minDscr` come from the financial model so financeability
 * reflects the actual modelled returns.
 */
export function scoreOpportunity(
  input: OpportunityInput,
  irrValue = NaN,
  minDscr = NaN
): ScoringResult {
  const categories: ScoreCategory[] = [
    scoreEnergyEconomics(input),
    scoreSiteViability(input),
    scoreContractability(input),
    scoreCarbonEsg(input),
    scoreFlexibility(input),
    scoreStrategicSector(input),
    scoreFinanceability(input, irrValue, minDscr),
  ];

  const overall = categories.reduce((a, c) => a + c.score * c.weight, 0);

  // Risk score: inverse of contractability + site + finance, plus contract risk.
  const contract = categories.find((c) => c.key === "contract")!.score;
  const site = categories.find((c) => c.key === "site")!.score;
  const finance = categories.find((c) => c.key === "finance")!.score;
  const riskScore = clamp(100 - avg([contract, site, finance]), 0, 100);

  return {
    overall,
    categories,
    recommendedAction: recommendAction(overall, riskScore),
    financialAttractiveness: categories.find((c) => c.key === "energy")!.score * 0.6 + finance * 0.4,
    carbonImpact: categories.find((c) => c.key === "carbon")!.score,
    gridFlexibilityValue: categories.find((c) => c.key === "flex")!.score,
    riskScore,
  };
}
