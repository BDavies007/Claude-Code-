import type { MarketProfile } from "@/types";

/**
 * Mock European market intelligence used by the Opportunity Map module.
 * Scores are 0-100 and reflect a qualitative house view for illustration.
 */
export const MARKET_PROFILES: MarketProfile[] = [
  {
    country: "United Kingdom",
    marketAttractiveness: 88,
    gridConstraintSeverity: 82,
    ppaMaturity: 85,
    carbonEsgPressure: 80,
    bessOpportunity: 90,
    regulatoryComplexity: 55,
    entryStrategy:
      "Lead market. Target logistics & data centres with co-located solar-BESS and behind-the-meter PPAs; monetise constraint via flexibility.",
  },
  {
    country: "Germany",
    marketAttractiveness: 84,
    gridConstraintSeverity: 78,
    ppaMaturity: 80,
    carbonEsgPressure: 90,
    bessOpportunity: 85,
    regulatoryComplexity: 70,
    entryStrategy:
      "High ESG/CSRD pull. Partner locally for permitting; focus on manufacturing corporates needing Scope 1/2 decarbonisation.",
  },
  {
    country: "Netherlands",
    marketAttractiveness: 82,
    gridConstraintSeverity: 95,
    ppaMaturity: 78,
    carbonEsgPressure: 82,
    bessOpportunity: 92,
    regulatoryComplexity: 60,
    entryStrategy:
      "Severe grid congestion (netcongestie) makes BESS + flexibility the hero product. Prioritise constrained industrial clusters.",
  },
  {
    country: "Poland",
    marketAttractiveness: 72,
    gridConstraintSeverity: 70,
    ppaMaturity: 55,
    carbonEsgPressure: 65,
    bessOpportunity: 75,
    regulatoryComplexity: 68,
    entryStrategy:
      "High-carbon grid offers strong abatement value. Enter via large manufacturing/logistics anchors; build PPA track record.",
  },
  {
    country: "Spain",
    marketAttractiveness: 80,
    gridConstraintSeverity: 50,
    ppaMaturity: 82,
    carbonEsgPressure: 70,
    bessOpportunity: 70,
    regulatoryComplexity: 58,
    entryStrategy:
      "Excellent solar yield and mature merchant PPA market. Pursue larger solar with storage to firm output and capture spreads.",
  },
  {
    country: "Italy",
    marketAttractiveness: 76,
    gridConstraintSeverity: 65,
    ppaMaturity: 68,
    carbonEsgPressure: 72,
    bessOpportunity: 78,
    regulatoryComplexity: 72,
    entryStrategy:
      "Strong incentives (Transizione 5.0) for industrial self-consumption. Target retail chains & manufacturing with EaaS bundles.",
  },
  {
    country: "France",
    marketAttractiveness: 70,
    gridConstraintSeverity: 45,
    ppaMaturity: 65,
    carbonEsgPressure: 75,
    bessOpportunity: 60,
    regulatoryComplexity: 75,
    entryStrategy:
      "Lower grid carbon limits abatement value; lead with cost savings & ESG reporting for multinational corporates.",
  },
  {
    country: "Ireland",
    marketAttractiveness: 78,
    gridConstraintSeverity: 88,
    ppaMaturity: 70,
    carbonEsgPressure: 78,
    bessOpportunity: 88,
    regulatoryComplexity: 62,
    entryStrategy:
      "Data-centre driven demand and tight grid. Position BESS + flexibility + corporate PPAs for hyperscale-adjacent loads.",
  },
  {
    country: "Nordics",
    marketAttractiveness: 74,
    gridConstraintSeverity: 55,
    ppaMaturity: 88,
    carbonEsgPressure: 68,
    bessOpportunity: 72,
    regulatoryComplexity: 50,
    entryStrategy:
      "Deep, mature PPA market and high ESG sophistication. Compete on platform/MRV differentiation and portfolio aggregation.",
  },
];
