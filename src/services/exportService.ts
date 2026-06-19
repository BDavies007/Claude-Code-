/**
 * Export service.
 *
 * Produces a flat, serialisable snapshot of an assessment suitable for future
 * Excel / PDF / report generation. Kept framework-agnostic so it can run on a
 * server (e.g. a Supabase edge function) as well as in the browser.
 */

import type {
  OpportunityInput,
  GlobalAssumptions,
  FinancialResult,
  ScoringResult,
  ScenarioResult,
} from "@/types";

export interface AssessmentExport {
  meta: {
    generatedAt: string;
    engine: string;
    version: string;
  };
  client: OpportunityInput["client"];
  site: OpportunityInput["site"];
  commercial: OpportunityInput["commercial"];
  technology: OpportunityInput["technology"];
  carbon: OpportunityInput["carbon"];
  assumptions: GlobalAssumptions;
  headline: {
    opportunityScore: number;
    recommendedAction: string;
    irr: number;
    npv: number;
    riskAdjustedNpv: number;
    paybackYears: number;
    totalRevenue25yr: number;
    clientBenefitPerYear: number;
    lightsummitRecurringMargin: number;
    totalCarbonTonnes: number;
  };
  scoring: {
    overall: number;
    categories: { label: string; weight: number; score: number }[];
  };
  cashFlows: FinancialResult["cashFlows"];
  scenarios: {
    label: string;
    score: number;
    irr: number;
    npv: number;
    riskAdjustedNpv: number;
    recommendedAction: string;
  }[];
}

export function buildAssessmentExport(
  input: OpportunityInput,
  global: GlobalAssumptions,
  financial: FinancialResult,
  scoring: ScoringResult,
  scenarios: ScenarioResult[]
): AssessmentExport {
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      engine: "Lightsummit Opportunity Assessing Engine",
      version: "0.1.0",
    },
    client: input.client,
    site: input.site,
    commercial: input.commercial,
    technology: input.technology,
    carbon: input.carbon,
    assumptions: global,
    headline: {
      opportunityScore: scoring.overall,
      recommendedAction: scoring.recommendedAction,
      irr: financial.irr,
      npv: financial.npv,
      riskAdjustedNpv: financial.riskAdjustedNpv,
      paybackYears: financial.paybackYears,
      totalRevenue25yr: financial.totalRevenue25yr,
      clientBenefitPerYear: financial.clientBenefitPerYear,
      lightsummitRecurringMargin: financial.lightsummitRecurringMargin,
      totalCarbonTonnes: financial.totalCarbonTonnes,
    },
    scoring: {
      overall: scoring.overall,
      categories: scoring.categories.map((c) => ({
        label: c.label,
        weight: c.weight,
        score: c.score,
      })),
    },
    cashFlows: financial.cashFlows,
    scenarios: scenarios.map((s) => ({
      label: s.scenario.label,
      score: s.scoring.overall,
      irr: s.financial.irr,
      npv: s.financial.npv,
      riskAdjustedNpv: s.financial.riskAdjustedNpv,
      recommendedAction: s.scoring.recommendedAction,
    })),
  };
}

/** Trigger a client-side JSON download of the assessment. */
export function downloadAssessmentJson(data: AssessmentExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = data.client.companyName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  a.href = url;
  a.download = `lightsummit-assessment-${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
