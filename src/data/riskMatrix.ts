import type { RiskItem } from "@/types";

/** Standard risk register for a decentralised energy PPA project. */
export const RISK_MATRIX: RiskItem[] = [
  {
    id: "r1",
    category: "Counterparty",
    risk: "Offtaker default or credit deterioration over the PPA term",
    likelihood: 2,
    impact: 5,
    mitigation:
      "Investment-grade screening, parent guarantees, credit insurance, step-in rights and diversified portfolio offtake.",
  },
  {
    id: "r2",
    category: "Grid / Connection",
    risk: "Connection delay or export curtailment reduces revenue",
    likelihood: 4,
    impact: 4,
    mitigation:
      "Early DNO engagement, behind-the-meter prioritisation, BESS to absorb constraint, constraint-managed connection agreements.",
  },
  {
    id: "r3",
    category: "Market / Price",
    risk: "Wholesale and grid prices fall, eroding savings spread",
    likelihood: 3,
    impact: 4,
    mitigation:
      "Fixed-price PPA with inflation indexation, take-or-pay floors and balanced merchant/contracted exposure.",
  },
  {
    id: "r4",
    category: "Construction",
    risk: "Capex overrun or build delay impacts returns",
    likelihood: 3,
    impact: 3,
    mitigation:
      "Fixed-price EPC, liquidated damages, contingency budget and staged drawdown.",
  },
  {
    id: "r5",
    category: "Technology",
    risk: "Underperformance or accelerated degradation of solar/BESS",
    likelihood: 2,
    impact: 3,
    mitigation:
      "Tier-1 equipment, performance warranties, O&M SLAs and digital MRV monitoring.",
  },
  {
    id: "r6",
    category: "Regulatory / Policy",
    risk: "Adverse changes to carbon, flexibility or grid policy",
    likelihood: 3,
    impact: 4,
    mitigation:
      "Geographic diversification, conservative carbon assumptions and active regulatory monitoring.",
  },
  {
    id: "r7",
    category: "Carbon Market",
    risk: "Carbon price volatility undermines carbon revenue stream",
    likelihood: 3,
    impact: 2,
    mitigation:
      "Treat carbon as upside not base case; forward sales and MRV-verified high-integrity credits.",
  },
  {
    id: "r8",
    category: "ESG / Reputational",
    risk: "Supply-chain or sourcing issues damage ESG credentials",
    likelihood: 2,
    impact: 3,
    mitigation:
      "Responsible sourcing policy, supplier due diligence, circularity and biodiversity commitments with annual reporting.",
  },
  {
    id: "r9",
    category: "Financing",
    risk: "Rising debt costs reduce equity returns / DSCR headroom",
    likelihood: 3,
    impact: 4,
    mitigation:
      "Interest-rate hedging, conservative gearing, strategic finance partnerships and refinancing optionality.",
  },
  {
    id: "r10",
    category: "Operational",
    risk: "Client load profile changes reduce self-consumption",
    likelihood: 2,
    impact: 3,
    mitigation:
      "Take-or-pay structuring, export routes and BESS time-shifting to preserve monetisation.",
  },
];
