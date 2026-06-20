import type { CashflowPoint, ScenarioInputs, ScenarioOutputs } from "@/types";

// =============================================================================
// Financial scenario engine.
//
// A deliberately transparent (and lightweight) project-finance model for a
// solar + storage asset. It is intentionally simple enough to recompute live
// on every slider change, while still producing the headline metrics an
// investment committee expects: IRR, NPV, EBITDA, payback, equity multiple,
// carbon value and client savings.
//
// Swap this module for a server-side model later without changing the UI —
// the inputs/outputs contracts live in src/types.
// =============================================================================

const PROJECT_LIFE_YEARS = 25;
const GENERATION_KWH_PER_KWP = 950; // UK-ish specific yield (kWh/kWp/yr)
const BATTERY_CYCLES_PER_YEAR = 365;
const BATTERY_ROUNDTRIP = 0.88;
const CARBON_INTENSITY_KG_PER_KWH = 0.207; // grid displacement factor
const DEGRADATION = 0.005; // 0.5% annual output degradation
const DISCOUNT_RATE = 0.07; // equity discount rate for NPV

export interface FinanceModel {
  outputs: ScenarioOutputs;
  cashflows: CashflowPoint[];
}

/** Net present value of a cashflow series at a given discount rate. */
function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i), 0);
}

/** Internal rate of return via bisection — robust and dependency-free. */
function irr(cashflows: number[]): number {
  let low = -0.9;
  let high = 1.0;
  let guess = 0.1;
  for (let i = 0; i < 80; i++) {
    guess = (low + high) / 2;
    const value = npv(guess, cashflows);
    if (Math.abs(value) < 1) break;
    if (value > 0) low = guess;
    else high = guess;
  }
  return guess * 100;
}

export function runScenario(inputs: ScenarioInputs): FinanceModel {
  const {
    ppaPrice,
    gridPrice,
    capexPerKwp,
    systemSizeKwp,
    batterySizeKwh,
    debtPct,
    interestRate,
    carbonPrice,
    inflation,
    omCostPerKwp,
  } = inputs;

  // --- Capital structure ---
  const solarCapex = systemSizeKwp * capexPerKwp;
  const batteryCapex = batterySizeKwh * 320; // £/kWh installed
  const totalCapex = solarCapex + batteryCapex;
  const debt = totalCapex * (debtPct / 100);
  const equity = totalCapex - debt;

  // --- Year-one energy & revenue ---
  const annualGenerationKwh = systemSizeKwp * GENERATION_KWH_PER_KWP;
  const annualGenerationMwh = annualGenerationKwh / 1000;

  // PPA income — generation sold under contract
  const ppaIncome = annualGenerationMwh * ppaPrice;

  // Battery arbitrage — charge cheap, discharge at spread vs grid
  const batteryThroughputMwh =
    (batterySizeKwh * BATTERY_CYCLES_PER_YEAR * BATTERY_ROUNDTRIP) / 1000;
  const arbitrageSpread = Math.max(gridPrice - ppaPrice, 12); // £/MWh floor
  const batteryRevenue = batteryThroughputMwh * arbitrageSpread;

  // Carbon value — displaced grid carbon monetised at carbon price
  const carbonTonnes =
    (annualGenerationKwh * CARBON_INTENSITY_KG_PER_KWH) / 1000;
  const carbonValue = carbonTonnes * carbonPrice;

  // Client savings — delta between grid price and PPA price on consumed energy
  const clientSavings = annualGenerationMwh * Math.max(gridPrice - ppaPrice, 0);

  // --- Costs ---
  const annualOpex = systemSizeKwp * omCostPerKwp;
  const interestY1 = debt * (interestRate / 100);

  const grossRevenueY1 = ppaIncome + batteryRevenue + carbonValue;
  const ebitda = grossRevenueY1 - annualOpex;

  // --- Multi-year cashflow build ---
  const cashflows: CashflowPoint[] = [];
  let cumulative = -equity;
  cashflows.push({ year: 0, cashflow: -equity, cumulative });

  const equityCashflows: number[] = [-equity];
  let remainingDebt = debt;
  const annualDebtService = debt > 0 ? debt / 15 : 0; // 15-yr amortisation

  for (let year = 1; year <= PROJECT_LIFE_YEARS; year++) {
    const escalation = Math.pow(1 + inflation / 100, year - 1);
    const degradationFactor = Math.pow(1 - DEGRADATION, year - 1);

    const revenue = grossRevenueY1 * escalation * degradationFactor;
    const opex = annualOpex * escalation;
    const interest = remainingDebt * (interestRate / 100);
    const principal = year <= 15 ? Math.min(annualDebtService, remainingDebt) : 0;
    remainingDebt = Math.max(0, remainingDebt - principal);

    const equityCf = revenue - opex - interest - principal;
    equityCashflows.push(equityCf);

    cumulative += equityCf;
    cashflows.push({
      year,
      cashflow: Math.round(equityCf),
      cumulative: Math.round(cumulative),
    });
  }

  // --- Headline metrics ---
  const projectIrr = irr(equityCashflows);
  const projectNpv = npv(DISCOUNT_RATE, equityCashflows);
  const totalEquityReturned = equityCashflows
    .slice(1)
    .reduce((a, b) => a + b, 0);
  const equityMultiple = equity > 0 ? (totalEquityReturned + equity) / equity : 0;

  // Payback — first year cumulative turns positive (interpolated)
  let payback = PROJECT_LIFE_YEARS;
  for (let i = 1; i < cashflows.length; i++) {
    if (cashflows[i].cumulative >= 0) {
      const prev = cashflows[i - 1].cumulative;
      const curr = cashflows[i].cumulative;
      const frac = prev < 0 ? -prev / (curr - prev) : 0;
      payback = i - 1 + frac;
      break;
    }
  }

  return {
    outputs: {
      irr: Number(projectIrr.toFixed(1)),
      npv: Math.round(projectNpv),
      ebitda: Math.round(ebitda),
      clientSavings: Math.round(clientSavings),
      payback: Number(payback.toFixed(1)),
      carbonValue: Math.round(carbonValue),
      equityReturn: Number(equityMultiple.toFixed(2)),
    },
    cashflows,
  };
}

export const DEFAULT_SCENARIO_INPUTS: ScenarioInputs = {
  ppaPrice: 95,
  gridPrice: 165,
  capexPerKwp: 750,
  systemSizeKwp: 5000,
  batterySizeKwh: 4000,
  debtPct: 65,
  interestRate: 7.5,
  carbonPrice: 75,
  inflation: 3,
  omCostPerKwp: 12,
};
