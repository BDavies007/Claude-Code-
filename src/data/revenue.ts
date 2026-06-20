import type { RevenueScenario, RevenueStream } from "@/types";

export const revenueScenarios: RevenueScenario[] = [
  { key: "base", label: "Base", description: "Central plan assumptions" },
  { key: "upside", label: "Upside", description: "High capture + carbon rally" },
  { key: "downside", label: "Downside", description: "Soft power & delivery slip" },
];

// Values are £m contribution to group revenue per scenario.
export const revenueStreams: RevenueStream[] = [
  {
    id: "developer-fees",
    label: "Developer fees",
    accent: "neon",
    values: { base: 18.4, upside: 24.1, downside: 12.6 },
  },
  {
    id: "epc-margin",
    label: "EPC margin",
    accent: "electric",
    values: { base: 31.2, upside: 38.5, downside: 22.0 },
  },
  {
    id: "om",
    label: "O&M",
    accent: "teal",
    values: { base: 12.8, upside: 14.2, downside: 11.0 },
  },
  {
    id: "asset-management",
    label: "Asset management",
    accent: "neon",
    values: { base: 8.6, upside: 9.8, downside: 7.4 },
  },
  {
    id: "ppa-income",
    label: "PPA income",
    accent: "electric",
    values: { base: 44.5, upside: 52.0, downside: 33.8 },
  },
  {
    id: "battery-optimisation",
    label: "Battery optimisation",
    accent: "teal",
    values: { base: 9.4, upside: 16.7, downside: 5.1 },
  },
  {
    id: "energy-trading",
    label: "Energy trading",
    accent: "electric",
    values: { base: 7.2, upside: 13.4, downside: 3.6 },
  },
  {
    id: "carbon-credits",
    label: "Carbon credits",
    accent: "neon",
    values: { base: 13.6, upside: 21.9, downside: 8.2 },
  },
];
