import type { OpportunityInput } from "@/types";

/**
 * A representative seed opportunity: a large UK logistics distribution centre.
 * Used as the default state for the intake form and dashboard.
 */
export const SAMPLE_OPPORTUNITY: OpportunityInput = {
  id: "opp-seed-001",
  client: {
    companyName: "Northgate Logistics Group",
    sector: "Logistics",
    country: "United Kingdom",
    creditRating: "A",
    esgUrgency: "High",
    decisionTimeline: "3-6 months",
    ownershipStatus: "Owner-occupier",
  },
  site: {
    region: "Midlands, UK",
    siteType: "Warehouse / Distribution",
    roofAreaM2: 32000,
    roofCondition: "Good",
    availableLandHa: 1.5,
    gridConnection: "Constrained export",
    annualConsumptionMWh: 9800,
    peakDemandMW: 3.2,
    operatingHoursPerDay: 18,
    evFleetPotential: true,
    highIntensityLoad: true,
  },
  commercial: {
    currentGridPrice: 0.245,
    gridPriceEscalation: 0.04,
    ppaTargetPrice: 0.165,
    ppaTermYears: 25,
    takeOrPayPct: 0.85,
    inflationIndexation: 0.03,
    clientSavingsTargetPct: 0.15,
    contractRisk: "Low",
  },
  technology: {
    solarMwp: 3.0,
    batteryPowerMW: 2.0,
    batteryEnergyMWh: 4.0,
    evChargers: 12,
    bemsRequired: true,
    flexibilityEligible: true,
    exportConstrained: true,
    capexPerKwp: 750,
    bessCostPerKwh: 320,
    omCostPerKwpYear: 12,
    performanceRatio: 0.85,
    degradationRate: 0.0045,
  },
  carbon: {
    gridEmissionsFactor: 0.21,
    carbonPrice: 75,
    carbonPriceGrowth: 0.06,
    mrvRequired: true,
    scopeRelevance: ["Scope 1", "Scope 2", "Scope 3"],
    esgReportingPressure: "High",
    supplierTransparencyNeed: true,
    biodiversityCircularity: true,
  },
};
