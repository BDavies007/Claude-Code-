/**
 * Scenario engine.
 *
 * Applies a set of named scenarios (Base, Conservative, Downside, Upside,
 * Aggressive Growth, Custom) to an opportunity by perturbing the input
 * assumptions and re-running both the financial model and the scoring engine.
 */

import type {
  OpportunityInput,
  GlobalAssumptions,
  ScenarioModifiers,
  ScenarioResult,
  ScenarioKey,
} from "@/types";
import { runFinancialModel } from "./financialCalculator";
import { scoreOpportunity } from "./scoringEngine";

/** The catalogue of built-in scenarios with their multipliers. */
export const SCENARIOS: Record<ScenarioKey, ScenarioModifiers> = {
  base: {
    key: "base",
    label: "Base Case",
    description: "Central assumptions in line with current market conditions.",
    gridPriceMult: 1.0,
    ppaPriceMult: 1.0,
    capexMult: 1.0,
    bessCostMult: 1.0,
    carbonPriceMult: 1.0,
    loadMult: 1.0,
    exportPriceMult: 1.0,
    debtCostMult: 1.0,
    riskMult: 1.0,
    constructionDelayMonths: 0,
    curtailmentPct: 0.02,
  },
  conservative: {
    key: "conservative",
    label: "Conservative",
    description: "Prudent assumptions with softer prices and higher costs.",
    gridPriceMult: 0.95,
    ppaPriceMult: 0.97,
    capexMult: 1.05,
    bessCostMult: 1.05,
    carbonPriceMult: 0.9,
    loadMult: 0.95,
    exportPriceMult: 0.9,
    debtCostMult: 1.1,
    riskMult: 1.2,
    constructionDelayMonths: 3,
    curtailmentPct: 0.04,
  },
  downside: {
    key: "downside",
    label: "Downside",
    description: "Stress case: weak prices, cost overruns and curtailment.",
    gridPriceMult: 0.85,
    ppaPriceMult: 0.92,
    capexMult: 1.15,
    bessCostMult: 1.15,
    carbonPriceMult: 0.75,
    loadMult: 0.85,
    exportPriceMult: 0.75,
    debtCostMult: 1.25,
    riskMult: 1.5,
    constructionDelayMonths: 6,
    curtailmentPct: 0.08,
  },
  upside: {
    key: "upside",
    label: "Upside",
    description: "Favourable prices, lower costs and strong carbon markets.",
    gridPriceMult: 1.1,
    ppaPriceMult: 1.05,
    capexMult: 0.95,
    bessCostMult: 0.92,
    carbonPriceMult: 1.2,
    loadMult: 1.05,
    exportPriceMult: 1.15,
    debtCostMult: 0.95,
    riskMult: 0.85,
    constructionDelayMonths: 0,
    curtailmentPct: 0.01,
  },
  aggressive: {
    key: "aggressive",
    label: "Aggressive Growth",
    description: "Bull case: high power & carbon prices, cheap capital, scale.",
    gridPriceMult: 1.25,
    ppaPriceMult: 1.1,
    capexMult: 0.88,
    bessCostMult: 0.82,
    carbonPriceMult: 1.5,
    loadMult: 1.15,
    exportPriceMult: 1.3,
    debtCostMult: 0.85,
    riskMult: 0.75,
    constructionDelayMonths: 0,
    curtailmentPct: 0.0,
  },
  custom: {
    key: "custom",
    label: "Custom",
    description: "User-defined assumptions.",
    gridPriceMult: 1.0,
    ppaPriceMult: 1.0,
    capexMult: 1.0,
    bessCostMult: 1.0,
    carbonPriceMult: 1.0,
    loadMult: 1.0,
    exportPriceMult: 1.0,
    debtCostMult: 1.0,
    riskMult: 1.0,
    constructionDelayMonths: 0,
    curtailmentPct: 0.02,
  },
};

/** Apply scenario multipliers to an opportunity input, returning a new copy. */
export function applyScenario(
  input: OpportunityInput,
  scenario: ScenarioModifiers
): OpportunityInput {
  return {
    ...input,
    site: {
      ...input.site,
      annualConsumptionMWh: input.site.annualConsumptionMWh * scenario.loadMult,
    },
    commercial: {
      ...input.commercial,
      currentGridPrice: input.commercial.currentGridPrice * scenario.gridPriceMult,
      ppaTargetPrice: input.commercial.ppaTargetPrice * scenario.ppaPriceMult,
    },
    technology: {
      ...input.technology,
      capexPerKwp: input.technology.capexPerKwp * scenario.capexMult,
      bessCostPerKwh: input.technology.bessCostPerKwh * scenario.bessCostMult,
    },
    carbon: {
      ...input.carbon,
      carbonPrice: input.carbon.carbonPrice * scenario.carbonPriceMult,
    },
  };
}

/** Run a single scenario end-to-end (financial + scoring). */
export function runScenario(
  input: OpportunityInput,
  global: GlobalAssumptions,
  scenario: ScenarioModifiers
): ScenarioResult {
  const adjustedInput = applyScenario(input, scenario);
  const adjustedGlobal: GlobalAssumptions = {
    ...global,
    debtCostRate: global.debtCostRate * scenario.debtCostMult,
  };

  // Construction delay erodes the first operating year via partial generation.
  const delayFactor = 1 - Math.min(scenario.constructionDelayMonths, 12) / 12;

  // First-pass financial run for IRR/DSCR feeding the score.
  const prelim = runFinancialModel(adjustedInput, adjustedGlobal, 40, {
    exportPricePerKwh: 0.05 * scenario.exportPriceMult,
    curtailmentPct: scenario.curtailmentPct + (1 - delayFactor) / input.commercial.ppaTermYears,
    riskMult: scenario.riskMult,
  });

  const scoring = scoreOpportunity(adjustedInput, prelim.irr, prelim.minDscr);

  // Final financial run using the derived risk score.
  const financial = runFinancialModel(adjustedInput, adjustedGlobal, scoring.riskScore, {
    exportPricePerKwh: 0.05 * scenario.exportPriceMult,
    curtailmentPct: scenario.curtailmentPct + (1 - delayFactor) / input.commercial.ppaTermYears,
    riskMult: scenario.riskMult,
  });

  return { scenario, financial, scoring };
}

/** Run all built-in scenarios for comparison. */
export function runAllScenarios(
  input: OpportunityInput,
  global: GlobalAssumptions
): ScenarioResult[] {
  return (Object.keys(SCENARIOS) as ScenarioKey[])
    .filter((k) => k !== "custom")
    .map((k) => runScenario(input, global, SCENARIOS[k]));
}
