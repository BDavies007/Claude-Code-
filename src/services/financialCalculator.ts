/**
 * Financial calculator service.
 *
 * A collection of pure, reusable functions for modelling a decentralised
 * energy project: generation, PPA revenue, developer margin, carbon value,
 * BESS arbitrage, flexibility revenue, opex, project cash flows and the
 * resulting NPV / IRR / payback / DSCR metrics.
 *
 * Every function is side-effect free so they can be composed by the scenario
 * engine and unit tested in isolation.
 */

import type {
  OpportunityInput,
  GlobalAssumptions,
  FinancialResult,
  YearlyCashFlow,
} from "@/types";

/** Hours in a standard year, used for capacity-factor based maths. */
const HOURS_PER_YEAR = 8760;

/**
 * Annual generation in MWh for a given operating year (1-indexed).
 * Accounts for performance ratio and linear-ish degradation.
 *
 * Uses a UK-representative specific yield of ~950 kWh/kWp/year as the base
 * before applying the performance ratio.
 */
export function annualGeneration(
  solarMwp: number,
  performanceRatio: number,
  degradationRate: number,
  year: number,
  specificYield = 950
): number {
  if (solarMwp <= 0) return 0;
  const grossKwhPerKwp = specificYield * performanceRatio;
  const degradation = Math.pow(1 - degradationRate, Math.max(0, year - 1));
  // solarMwp (MWp) * 1000 (kWp/MWp) * kWh/kWp / 1000 (kWh->MWh)
  return solarMwp * 1000 * grossKwhPerKwp * degradation / 1000;
}

/**
 * Client savings: the difference between the prevailing grid price and the
 * PPA price applied to the consumed (take-or-pay) volume, escalated by year.
 */
export function clientSavings(
  input: OpportunityInput,
  generationMWh: number,
  year: number
): number {
  const { commercial } = input;
  const gridPrice =
    commercial.currentGridPrice *
    Math.pow(1 + commercial.gridPriceEscalation, year - 1);
  const ppaPrice =
    commercial.ppaTargetPrice *
    Math.pow(1 + commercial.inflationIndexation, year - 1);
  const consumedMWh = consumedVolume(input, generationMWh);
  // £/kWh * MWh * 1000 kWh/MWh
  return Math.max(0, (gridPrice - ppaPrice) * consumedMWh * 1000);
}

/** Volume the client actually buys under the PPA (capped by consumption & take-or-pay). */
function consumedVolume(input: OpportunityInput, generationMWh: number): number {
  const maxOfftake = Math.min(generationMWh, input.site.annualConsumptionMWh);
  return maxOfftake * input.commercial.takeOrPayPct;
}

/** PPA revenue to the project from the offtaker for a given year. */
export function ppaRevenue(
  input: OpportunityInput,
  generationMWh: number,
  year: number
): number {
  const ppaPrice =
    input.commercial.ppaTargetPrice *
    Math.pow(1 + input.commercial.inflationIndexation, year - 1);
  const consumedMWh = consumedVolume(input, generationMWh);
  return ppaPrice * consumedMWh * 1000;
}

/** Lightsummit developer margin (recurring) on delivered energy. */
export function developerMargin(
  input: OpportunityInput,
  generationMWh: number,
  marginPerKwh: number,
  year: number
): number {
  const consumedMWh = consumedVolume(input, generationMWh);
  // Margin escalates with inflation indexation to preserve real value.
  const escalated =
    marginPerKwh * Math.pow(1 + input.commercial.inflationIndexation, year - 1);
  return escalated * consumedMWh * 1000;
}

/** Carbon value from avoided grid emissions, with a growing carbon price. */
export function carbonValue(
  input: OpportunityInput,
  generationMWh: number,
  year: number
): { tonnes: number; value: number } {
  const { carbon } = input;
  const tonnes = generationMWh * carbon.gridEmissionsFactor;
  const price =
    carbon.carbonPrice * Math.pow(1 + carbon.carbonPriceGrowth, year - 1);
  return { tonnes, value: tonnes * price };
}

/**
 * BESS arbitrage value: revenue from buy-low / sell-high energy shifting.
 * Assumes ~1 cycle/day, a representative price spread and round-trip
 * efficiency, scaled by the battery energy capacity.
 */
export function bessArbitrageValue(
  batteryEnergyMWh: number,
  priceSpreadPerKwh = 0.08,
  cyclesPerYear = 350,
  roundTripEfficiency = 0.88
): number {
  if (batteryEnergyMWh <= 0) return 0;
  return (
    batteryEnergyMWh *
    1000 *
    priceSpreadPerKwh *
    cyclesPerYear *
    roundTripEfficiency
  );
}

/**
 * Flexibility / grid-services revenue (e.g. DSR, capacity market, balancing).
 * Driven by battery power capacity and eligibility.
 */
export function flexibilityRevenue(
  batteryPowerMW: number,
  eligible: boolean,
  revenuePerMWYear = 45000
): number {
  if (!eligible || batteryPowerMW <= 0) return 0;
  return batteryPowerMW * revenuePerMWYear;
}

/** Export revenue from any generation surplus to consumption. */
export function exportRevenue(
  input: OpportunityInput,
  generationMWh: number,
  exportPricePerKwh = 0.05,
  year: number
): number {
  if (input.technology.exportConstrained) return 0;
  const surplus = Math.max(0, generationMWh - input.site.annualConsumptionMWh);
  const price =
    exportPricePerKwh * Math.pow(1 + input.commercial.inflationIndexation, year - 1);
  return surplus * 1000 * price;
}

/** Total project capex (solar + BESS). */
export function totalCapex(input: OpportunityInput): number {
  const { technology } = input;
  const solarCapex = technology.solarMwp * 1000 * technology.capexPerKwp;
  const bessCapex = technology.batteryEnergyMWh * 1000 * technology.bessCostPerKwh;
  return solarCapex + bessCapex;
}

/** Annual operating cost, escalated with inflation. */
export function opex(
  input: OpportunityInput,
  global: GlobalAssumptions,
  year: number
): number {
  const baseOm =
    input.technology.solarMwp * 1000 * input.technology.omCostPerKwpYear;
  // BESS O&M approximated as 1.5% of BESS capex per year.
  const bessOm =
    input.technology.batteryEnergyMWh * 1000 * input.technology.bessCostPerKwh * 0.015;
  return (baseOm + bessOm) * Math.pow(1 + global.inflation, year - 1);
}

/** Level annual debt service (annuity) for the project's debt tranche. */
function annualDebtService(capex: number, global: GlobalAssumptions): number {
  const principal = capex * global.debtRatio;
  if (principal <= 0 || global.debtTermYears <= 0) return 0;
  const r = global.debtCostRate;
  if (r === 0) return principal / global.debtTermYears;
  const factor =
    (r * Math.pow(1 + r, global.debtTermYears)) /
    (Math.pow(1 + r, global.debtTermYears) - 1);
  return principal * factor;
}

/**
 * Build the full project cash-flow schedule across the PPA term.
 */
export function projectCashFlows(
  input: OpportunityInput,
  global: GlobalAssumptions,
  options: {
    marginPerKwh?: number;
    exportPricePerKwh?: number;
    curtailmentPct?: number;
  } = {}
): { capex: number; cashFlows: YearlyCashFlow[] } {
  const marginPerKwh = options.marginPerKwh ?? global.developerMarginPerKwh;
  const exportPrice = options.exportPricePerKwh ?? 0.05;
  const curtailment = options.curtailmentPct ?? 0;

  const capex = totalCapex(input);
  const debtService = annualDebtService(capex, global);
  const term = input.commercial.ppaTermYears;
  const cashFlows: YearlyCashFlow[] = [];

  let cumulative = -capex * (1 - global.debtRatio); // equity outflow at t0

  for (let year = 1; year <= term; year++) {
    const rawGen = annualGeneration(
      input.technology.solarMwp,
      input.technology.performanceRatio,
      input.technology.degradationRate,
      year
    );
    const generationMWh = rawGen * (1 - curtailment);

    const ppa = ppaRevenue(input, generationMWh, year);
    const savings = clientSavings(input, generationMWh, year);
    const margin = developerMargin(input, generationMWh, marginPerKwh, year);
    const carbon = carbonValue(input, generationMWh, year);
    const bess = bessArbitrageValue(input.technology.batteryEnergyMWh);
    const flex = flexibilityRevenue(
      input.technology.batteryPowerMW,
      input.technology.flexibilityEligible
    );
    const exportRev = exportRevenue(input, generationMWh, exportPrice, year);

    const grossRevenue = ppa + carbon.value + bess + flex + exportRev;
    const yearOpex = opex(input, global, year);
    const ebitda = grossRevenue - yearOpex;
    const netCashFlow = ebitda - debtService;
    cumulative += netCashFlow;

    const dscr = debtService > 0 ? ebitda / debtService : Infinity;

    cashFlows.push({
      year,
      generationMWh,
      ppaRevenue: ppa,
      clientSavings: savings,
      developerMargin: margin,
      carbonValue: carbon.value,
      bessArbitrage: bess,
      flexibilityRevenue: flex,
      exportRevenue: exportRev,
      grossRevenue,
      opex: yearOpex,
      debtService,
      ebitda,
      netCashFlow,
      cumulativeCashFlow: cumulative,
      dscr,
    });
  }

  return { capex, cashFlows };
}

/** Net present value of a stream of cash flows discounted at `rate`. */
export function npv(rate: number, initialOutflow: number, flows: number[]): number {
  return flows.reduce(
    (acc, cf, i) => acc + cf / Math.pow(1 + rate, i + 1),
    -initialOutflow
  );
}

/** Internal rate of return via bisection. Returns NaN if no sign change. */
export function irr(initialOutflow: number, flows: number[]): number {
  const f = (rate: number) =>
    flows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i + 1), -initialOutflow);

  let low = -0.9;
  let high = 1.5;
  let fLow = f(low);
  let fHigh = f(high);
  if (fLow * fHigh > 0) return NaN; // no root in range

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < 1) return mid;
    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }
  return (low + high) / 2;
}

/** Simple payback period in years (with fractional interpolation). */
export function payback(initialOutflow: number, flows: number[]): number {
  let cumulative = -initialOutflow;
  for (let i = 0; i < flows.length; i++) {
    const prev = cumulative;
    cumulative += flows[i];
    if (cumulative >= 0) {
      const fraction = prev < 0 ? -prev / flows[i] : 0;
      return i + fraction;
    }
  }
  return Infinity;
}

/** Debt service coverage ratio summary from the cash-flow schedule. */
export function dscr(cashFlows: YearlyCashFlow[]): { min: number; avg: number } {
  const valid = cashFlows.filter((c) => isFinite(c.dscr));
  if (valid.length === 0) return { min: Infinity, avg: Infinity };
  const min = Math.min(...valid.map((c) => c.dscr));
  const avg = valid.reduce((a, c) => a + c.dscr, 0) / valid.length;
  return { min, avg };
}

/**
 * Risk-adjusted NPV: discounts at the base rate plus a premium scaled by the
 * project's risk score (0-100). A risk score of 50 adds ~2.5% to the rate.
 */
export function riskAdjustedNPV(
  initialOutflow: number,
  flows: number[],
  baseRate: number,
  riskScore: number,
  riskMult = 1
): number {
  const premium = (riskScore / 100) * 0.05 * riskMult;
  return npv(baseRate + premium, initialOutflow, flows);
}

/**
 * Run the full financial model and return the consolidated result object.
 */
export function runFinancialModel(
  input: OpportunityInput,
  global: GlobalAssumptions,
  riskScore = 40,
  options: {
    marginPerKwh?: number;
    exportPricePerKwh?: number;
    curtailmentPct?: number;
    riskMult?: number;
  } = {}
): FinancialResult {
  const { capex, cashFlows } = projectCashFlows(input, global, options);
  const equityOutflow = capex * (1 - global.debtRatio);
  const netFlows = cashFlows.map((c) => c.netCashFlow);

  const projectNpv = npv(global.discountRate, equityOutflow, netFlows);
  const raNpv = riskAdjustedNPV(
    equityOutflow,
    netFlows,
    global.discountRate,
    riskScore,
    options.riskMult ?? 1
  );
  const projectIrr = irr(equityOutflow, netFlows);
  const paybackYears = payback(equityOutflow, netFlows);
  const dscrSummary = dscr(cashFlows);

  const totalRevenue25yr = cashFlows.reduce((a, c) => a + c.grossRevenue, 0);
  const clientBenefitPerYear =
    cashFlows.length > 0
      ? cashFlows.reduce((a, c) => a + c.clientSavings, 0) / cashFlows.length
      : 0;
  const lightsummitRecurringMargin =
    cashFlows.length > 0
      ? cashFlows.reduce((a, c) => a + c.developerMargin, 0) / cashFlows.length
      : 0;
  const totalCarbonTonnes = cashFlows.reduce(
    (a, c) => a + (c.carbonValue > 0 ? carbonTonnesFromValue(input, c.year, c.carbonValue) : 0),
    0
  );
  const totalCarbonValue = cashFlows.reduce((a, c) => a + c.carbonValue, 0);
  const lifetimeGenerationMWh = cashFlows.reduce((a, c) => a + c.generationMWh, 0);

  return {
    capex,
    cashFlows,
    npv: projectNpv,
    riskAdjustedNpv: raNpv,
    irr: projectIrr,
    paybackYears,
    minDscr: dscrSummary.min,
    avgDscr: dscrSummary.avg,
    totalRevenue25yr,
    clientBenefitPerYear,
    lightsummitRecurringMargin,
    totalCarbonTonnes,
    totalCarbonValue,
    lifetimeGenerationMWh,
  };
}

/** Helper to back out tonnes from a value figure given the year's price. */
function carbonTonnesFromValue(
  input: OpportunityInput,
  year: number,
  value: number
): number {
  const price =
    input.carbon.carbonPrice *
    Math.pow(1 + input.carbon.carbonPriceGrowth, year - 1);
  return price > 0 ? value / price : 0;
}

/**
 * Portfolio aggregation: combine multiple financial results into a single
 * portfolio view (used for long-term aggregation strategy).
 */
export function portfolioValue(results: FinancialResult[]): {
  totalNpv: number;
  totalCapex: number;
  totalRevenue: number;
  totalCarbonTonnes: number;
  weightedIrr: number;
} {
  if (results.length === 0) {
    return {
      totalNpv: 0,
      totalCapex: 0,
      totalRevenue: 0,
      totalCarbonTonnes: 0,
      weightedIrr: 0,
    };
  }
  const totalCapex = results.reduce((a, r) => a + r.capex, 0);
  const totalNpv = results.reduce((a, r) => a + r.npv, 0);
  const totalRevenue = results.reduce((a, r) => a + r.totalRevenue25yr, 0);
  const totalCarbonTonnes = results.reduce((a, r) => a + r.totalCarbonTonnes, 0);
  // Capex-weighted IRR.
  const weightedIrr =
    totalCapex > 0
      ? results.reduce(
          (a, r) => a + (isFinite(r.irr) ? r.irr * r.capex : 0),
          0
        ) / totalCapex
      : 0;
  return { totalNpv, totalCapex, totalRevenue, totalCarbonTonnes, weightedIrr };
}

/** Sensible default global assumptions per the model brief. */
export const DEFAULT_GLOBAL_ASSUMPTIONS: GlobalAssumptions = {
  discountRate: 0.08,
  inflation: 0.03,
  developerMarginPerKwh: 0.01, // 1p/kWh
  debtRatio: 0.6,
  debtCostRate: 0.06,
  debtTermYears: 15,
};
