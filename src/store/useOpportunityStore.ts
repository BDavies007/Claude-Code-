import { create } from "zustand";
import type {
  OpportunityInput,
  GlobalAssumptions,
  FinancialResult,
  ScoringResult,
  ScenarioResult,
  ScenarioKey,
} from "@/types";
import { SAMPLE_OPPORTUNITY } from "@/data/sampleOpportunity";
import {
  runFinancialModel,
  DEFAULT_GLOBAL_ASSUMPTIONS,
} from "@/services/financialCalculator";
import { scoreOpportunity } from "@/services/scoringEngine";
import { runAllScenarios, runScenario, SCENARIOS } from "@/services/scenarioEngine";

/** Deep-merge helper for nested partial updates of the opportunity input. */
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** The object-valued sections of an opportunity (excludes scalar fields like `id`). */
type ObjectSection = "client" | "site" | "commercial" | "technology" | "carbon";

interface OpportunityState {
  input: OpportunityInput;
  global: GlobalAssumptions;
  activeScenario: ScenarioKey;

  // Derived (recomputed on every mutation)
  financial: FinancialResult;
  scoring: ScoringResult;
  scenarios: ScenarioResult[];

  // Actions
  updateInput: (patch: DeepPartial<OpportunityInput>) => void;
  updateSection: <K extends ObjectSection>(
    section: K,
    patch: Partial<OpportunityInput[K]>
  ) => void;
  updateGlobal: (patch: Partial<GlobalAssumptions>) => void;
  setScenario: (key: ScenarioKey) => void;
  reset: () => void;
}

function recompute(input: OpportunityInput, global: GlobalAssumptions, scenarioKey: ScenarioKey) {
  const scenario = SCENARIOS[scenarioKey];
  const active = runScenario(input, global, scenario);
  const scenarios = runAllScenarios(input, global);
  return {
    financial: active.financial,
    scoring: active.scoring,
    scenarios,
  };
}

const initialDerived = recompute(SAMPLE_OPPORTUNITY, DEFAULT_GLOBAL_ASSUMPTIONS, "base");

export const useOpportunityStore = create<OpportunityState>((set, get) => ({
  input: SAMPLE_OPPORTUNITY,
  global: DEFAULT_GLOBAL_ASSUMPTIONS,
  activeScenario: "base",
  ...initialDerived,

  updateSection: (section, patch) => {
    const input = {
      ...get().input,
      [section]: { ...get().input[section], ...patch },
    };
    set({ input, ...recompute(input, get().global, get().activeScenario) });
  },

  updateInput: (patch) => {
    const current = get().input;
    const input: OpportunityInput = {
      ...current,
      ...patch,
      client: { ...current.client, ...(patch.client ?? {}) },
      site: { ...current.site, ...(patch.site ?? {}) },
      commercial: { ...current.commercial, ...(patch.commercial ?? {}) },
      technology: { ...current.technology, ...(patch.technology ?? {}) },
      carbon: { ...current.carbon, ...(patch.carbon ?? {}) },
    } as OpportunityInput;
    set({ input, ...recompute(input, get().global, get().activeScenario) });
  },

  updateGlobal: (patch) => {
    const global = { ...get().global, ...patch };
    set({ global, ...recompute(get().input, global, get().activeScenario) });
  },

  setScenario: (key) => {
    set({ activeScenario: key, ...recompute(get().input, get().global, key) });
  },

  reset: () => {
    set({
      input: SAMPLE_OPPORTUNITY,
      global: DEFAULT_GLOBAL_ASSUMPTIONS,
      activeScenario: "base",
      ...recompute(SAMPLE_OPPORTUNITY, DEFAULT_GLOBAL_ASSUMPTIONS, "base"),
    });
  },
}));
