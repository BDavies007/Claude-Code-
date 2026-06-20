"use client";

import { useOpportunityStore } from "@/store/useOpportunityStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberField, TextField, SelectField, CheckboxField } from "@/components/shared/Field";
import { Upload, RotateCcw } from "lucide-react";
import type {
  Sector,
  Country,
  CreditRating,
  EsgUrgency,
  DecisionTimeline,
  OwnershipStatus,
  SiteType,
  RoofCondition,
  GridConnectionStatus,
  ContractRisk,
} from "@/types";

const SECTORS: readonly Sector[] = [
  "Logistics",
  "Manufacturing",
  "Data Centre",
  "Retail",
  "Commercial Office",
  "Public Sector",
  "Cold Storage",
  "Industrial",
];
const COUNTRIES: readonly Country[] = [
  "United Kingdom",
  "Germany",
  "Netherlands",
  "Poland",
  "Spain",
  "Italy",
  "France",
  "Ireland",
  "Nordics",
];
const CREDIT: readonly CreditRating[] = ["AAA", "AA", "A", "BBB", "BB", "B", "Unrated"];
const ESG: readonly EsgUrgency[] = ["Low", "Moderate", "High", "Mandatory"];
const TIMELINE: readonly DecisionTimeline[] = ["<3 months", "3-6 months", "6-12 months", "12+ months"];
const OWNERSHIP: readonly OwnershipStatus[] = ["Owner-occupier", "Long lease", "Short lease", "Multi-let"];
const SITE_TYPES: readonly SiteType[] = [
  "Warehouse / Distribution",
  "Factory / Plant",
  "Data Centre",
  "Retail Park",
  "Office Campus",
  "Mixed Use",
  "Public Building",
];
const ROOF: readonly RoofCondition[] = ["New / Excellent", "Good", "Fair", "Poor / Requires works"];
const GRID: readonly GridConnectionStatus[] = [
  "Strong import & export",
  "Import only",
  "Constrained export",
  "Heavily constrained",
  "Connection required",
];
const CONTRACT_RISK: readonly ContractRisk[] = ["Low", "Medium", "High"];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      </CardContent>
    </Card>
  );
}

export function SiteIntakeForm() {
  const { input, updateSection, reset } = useOpportunityStore();
  const { client, site, commercial, technology, carbon } = input;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Site Intake</h2>
          <p className="text-sm text-muted-foreground">
            Every field feeds the scoring engine and financial model in real time.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Reset to sample
        </Button>
      </div>

      {/* A. Client details */}
      <Section title="A. Client details" description="Who is the offtaker and how ready are they?">
        <TextField label="Company name" value={client.companyName} onChange={(v) => updateSection("client", { companyName: v })} />
        <SelectField label="Sector" value={client.sector} options={SECTORS} onChange={(v) => updateSection("client", { sector: v })} />
        <SelectField label="Country" value={client.country} options={COUNTRIES} onChange={(v) => updateSection("client", { country: v })} />
        <SelectField label="Credit rating" value={client.creditRating} options={CREDIT} onChange={(v) => updateSection("client", { creditRating: v })} />
        <SelectField label="ESG urgency" value={client.esgUrgency} options={ESG} onChange={(v) => updateSection("client", { esgUrgency: v })} />
        <SelectField label="Decision timeline" value={client.decisionTimeline} options={TIMELINE} onChange={(v) => updateSection("client", { decisionTimeline: v })} />
        <SelectField label="Ownership / lease status" value={client.ownershipStatus} options={OWNERSHIP} onChange={(v) => updateSection("client", { ownershipStatus: v })} />
      </Section>

      {/* B. Site details */}
      <Section title="B. Site details" description="Physical and energy characteristics of the site.">
        <TextField label="Address / region" value={site.region} onChange={(v) => updateSection("site", { region: v })} />
        <SelectField label="Site type" value={site.siteType} options={SITE_TYPES} onChange={(v) => updateSection("site", { siteType: v })} />
        <NumberField label="Roof area" suffix="m²" value={site.roofAreaM2} onChange={(v) => updateSection("site", { roofAreaM2: v })} />
        <SelectField label="Roof condition" value={site.roofCondition} options={ROOF} onChange={(v) => updateSection("site", { roofCondition: v })} />
        <NumberField label="Available land" suffix="ha" value={site.availableLandHa} onChange={(v) => updateSection("site", { availableLandHa: v })} />
        <SelectField label="Grid connection" value={site.gridConnection} options={GRID} onChange={(v) => updateSection("site", { gridConnection: v })} />
        <NumberField label="Annual consumption" suffix="MWh" value={site.annualConsumptionMWh} onChange={(v) => updateSection("site", { annualConsumptionMWh: v })} />
        <NumberField label="Peak demand" suffix="MW" value={site.peakDemandMW} onChange={(v) => updateSection("site", { peakDemandMW: v })} />
        <NumberField label="Operating hours / day" value={site.operatingHoursPerDay} onChange={(v) => updateSection("site", { operatingHoursPerDay: v })} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Half-hourly load profile</label>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background/40 text-xs text-muted-foreground hover:bg-secondary/50"
          >
            <Upload className="h-3.5 w-3.5" /> Upload CSV (placeholder)
          </button>
        </div>
        <CheckboxField label="EV fleet potential" value={site.evFleetPotential} onChange={(v) => updateSection("site", { evFleetPotential: v })} />
        <CheckboxField label="Data centre / HVAC / cold storage load" value={site.highIntensityLoad} onChange={(v) => updateSection("site", { highIntensityLoad: v })} />
      </Section>

      {/* C. Commercial details */}
      <Section title="C. Commercial details" description="PPA structure and price assumptions.">
        <NumberField label="Current grid price" suffix="£/kWh" step={0.001} value={commercial.currentGridPrice} onChange={(v) => updateSection("commercial", { currentGridPrice: v })} />
        <NumberField label="Grid price escalation" suffix="frac/yr" step={0.01} value={commercial.gridPriceEscalation} onChange={(v) => updateSection("commercial", { gridPriceEscalation: v })} />
        <NumberField label="PPA target price" suffix="£/kWh" step={0.001} value={commercial.ppaTargetPrice} onChange={(v) => updateSection("commercial", { ppaTargetPrice: v })} />
        <NumberField label="PPA term" suffix="years" value={commercial.ppaTermYears} onChange={(v) => updateSection("commercial", { ppaTermYears: v })} />
        <NumberField label="Take-or-pay" suffix="frac" step={0.05} value={commercial.takeOrPayPct} onChange={(v) => updateSection("commercial", { takeOrPayPct: v })} />
        <NumberField label="Inflation indexation" suffix="frac/yr" step={0.01} value={commercial.inflationIndexation} onChange={(v) => updateSection("commercial", { inflationIndexation: v })} />
        <NumberField label="Client savings target" suffix="frac" step={0.01} value={commercial.clientSavingsTargetPct} onChange={(v) => updateSection("commercial", { clientSavingsTargetPct: v })} />
        <SelectField label="Contract risk level" value={commercial.contractRisk} options={CONTRACT_RISK} onChange={(v) => updateSection("commercial", { contractRisk: v })} />
      </Section>

      {/* D. Technology assumptions */}
      <Section title="D. Technology assumptions" description="System sizing and engineering cost inputs.">
        <NumberField label="Solar PV size" suffix="MWp" step={0.1} value={technology.solarMwp} onChange={(v) => updateSection("technology", { solarMwp: v })} />
        <NumberField label="Battery power" suffix="MW" step={0.1} value={technology.batteryPowerMW} onChange={(v) => updateSection("technology", { batteryPowerMW: v })} />
        <NumberField label="Battery energy" suffix="MWh" step={0.1} value={technology.batteryEnergyMWh} onChange={(v) => updateSection("technology", { batteryEnergyMWh: v })} />
        <NumberField label="EV chargers" value={technology.evChargers} onChange={(v) => updateSection("technology", { evChargers: v })} />
        <NumberField label="Capex per kWp" suffix="£/kWp" value={technology.capexPerKwp} onChange={(v) => updateSection("technology", { capexPerKwp: v })} />
        <NumberField label="BESS cost per kWh" suffix="£/kWh" value={technology.bessCostPerKwh} onChange={(v) => updateSection("technology", { bessCostPerKwh: v })} />
        <NumberField label="O&M cost" suffix="£/kWp/yr" value={technology.omCostPerKwpYear} onChange={(v) => updateSection("technology", { omCostPerKwpYear: v })} />
        <NumberField label="Performance ratio" suffix="frac" step={0.01} value={technology.performanceRatio} onChange={(v) => updateSection("technology", { performanceRatio: v })} />
        <NumberField label="Degradation rate" suffix="frac/yr" step={0.001} value={technology.degradationRate} onChange={(v) => updateSection("technology", { degradationRate: v })} />
        <CheckboxField label="BEMS / HEMS required" value={technology.bemsRequired} onChange={(v) => updateSection("technology", { bemsRequired: v })} />
        <CheckboxField label="Flexibility services eligible" value={technology.flexibilityEligible} onChange={(v) => updateSection("technology", { flexibilityEligible: v })} />
        <CheckboxField label="Export constrained" value={technology.exportConstrained} onChange={(v) => updateSection("technology", { exportConstrained: v })} />
      </Section>

      {/* E. Carbon and ESG */}
      <Section title="E. Carbon & ESG" description="Carbon market and ESG / MRV drivers.">
        <NumberField label="Grid emissions factor" suffix="tCO₂/MWh" step={0.01} value={carbon.gridEmissionsFactor} onChange={(v) => updateSection("carbon", { gridEmissionsFactor: v })} />
        <NumberField label="Carbon price" suffix="£/tCO₂" value={carbon.carbonPrice} onChange={(v) => updateSection("carbon", { carbonPrice: v })} />
        <NumberField label="Carbon price growth" suffix="frac/yr" step={0.01} value={carbon.carbonPriceGrowth} onChange={(v) => updateSection("carbon", { carbonPriceGrowth: v })} />
        <SelectField label="ESG reporting pressure" value={carbon.esgReportingPressure} options={ESG} onChange={(v) => updateSection("carbon", { esgReportingPressure: v })} />
        <CheckboxField label="MRV required" value={carbon.mrvRequired} onChange={(v) => updateSection("carbon", { mrvRequired: v })} />
        <CheckboxField label="Supplier transparency need" value={carbon.supplierTransparencyNeed} onChange={(v) => updateSection("carbon", { supplierTransparencyNeed: v })} />
        <CheckboxField label="Biodiversity / circularity requirement" value={carbon.biodiversityCircularity} onChange={(v) => updateSection("carbon", { biodiversityCircularity: v })} />
        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
          <label className="text-xs font-medium text-muted-foreground">Scope 1/2/3 relevance</label>
          <div className="flex flex-wrap gap-2">
            {(["Scope 1", "Scope 2", "Scope 3"] as const).map((scope) => {
              const active = carbon.scopeRelevance.includes(scope);
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() =>
                    updateSection("carbon", {
                      scopeRelevance: active
                        ? carbon.scopeRelevance.filter((s) => s !== scope)
                        : [...carbon.scopeRelevance, scope],
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-input text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  {scope}
                </button>
              );
            })}
          </div>
        </div>
      </Section>
    </div>
  );
}
