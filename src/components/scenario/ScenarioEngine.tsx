"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DEFAULT_SCENARIO_INPUTS, runScenario } from "@/lib/finance";
import type { ScenarioInputs } from "@/types";
import { Slider } from "./Slider";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Panel } from "@/components/ui/Panel";
import { formatCurrency, formatMultiple, formatPercent } from "@/lib/format";

interface SliderConfig {
  key: keyof ScenarioInputs;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: SliderConfig[] = [
  { key: "ppaPrice", label: "PPA price", min: 40, max: 180, step: 1, unit: "£/MWh" },
  { key: "gridPrice", label: "Grid price", min: 80, max: 320, step: 1, unit: "£/MWh" },
  { key: "capexPerKwp", label: "Capex", min: 400, max: 1200, step: 10, unit: "£/kWp" },
  { key: "systemSizeKwp", label: "System size", min: 500, max: 20000, step: 100, unit: "kWp" },
  { key: "batterySizeKwh", label: "Battery size", min: 0, max: 20000, step: 100, unit: "kWh" },
  { key: "debtPct", label: "Debt", min: 0, max: 90, step: 1, unit: "%" },
  { key: "interestRate", label: "Interest rate", min: 2, max: 14, step: 0.1, unit: "%" },
  { key: "carbonPrice", label: "Carbon price", min: 0, max: 200, step: 1, unit: "£/t" },
  { key: "inflation", label: "Inflation", min: 0, max: 10, step: 0.1, unit: "%" },
  { key: "omCostPerKwp", label: "O&M cost", min: 4, max: 40, step: 0.5, unit: "£/kWp" },
];

function OutputTile({
  label,
  value,
  accent,
  index,
}: {
  label: string;
  value: string;
  accent: "neon" | "teal" | "electric";
  index: number;
}) {
  const ring =
    accent === "neon"
      ? "shadow-glow border-neon/20"
      : accent === "teal"
        ? "shadow-glow-teal border-teal/20"
        : "shadow-glow-blue border-electric/20";
  const text =
    accent === "neon" ? "text-neon" : accent === "teal" ? "text-teal" : "text-electric";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-xl border bg-base-700/40 p-4 ${ring}`}
    >
      <p className="label-eyebrow">{label}</p>
      <motion.p
        key={value}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        className={`mt-1 font-mono text-xl font-semibold ${text}`}
      >
        {value}
      </motion.p>
    </motion.div>
  );
}

function CashflowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-base-800/95 px-3 py-2 text-xs shadow-panel backdrop-blur">
      <p className="font-semibold text-white">Year {label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-mono" style={{ color: p.color }}>
          {p.dataKey === "cumulative" ? "Cumulative" : "Cashflow"}:{" "}
          {formatCurrency(p.value, { compact: true })}
        </p>
      ))}
    </div>
  );
}

export function ScenarioEngine() {
  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULT_SCENARIO_INPUTS);

  const { outputs, cashflows } = useMemo(() => runScenario(inputs), [inputs]);

  const update = (key: keyof ScenarioInputs, value: number) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const reset = () => setInputs(DEFAULT_SCENARIO_INPUTS);

  const tiles = [
    { label: "Project IRR", value: formatPercent(outputs.irr), accent: "neon" as const },
    { label: "NPV", value: formatCurrency(outputs.npv, { compact: true }), accent: "teal" as const },
    { label: "EBITDA / yr", value: formatCurrency(outputs.ebitda, { compact: true }), accent: "electric" as const },
    { label: "Payback", value: `${outputs.payback} yrs`, accent: "neon" as const },
    { label: "Client savings / yr", value: formatCurrency(outputs.clientSavings, { compact: true }), accent: "teal" as const },
    { label: "Carbon value / yr", value: formatCurrency(outputs.carbonValue, { compact: true }), accent: "electric" as const },
    { label: "Equity multiple", value: formatMultiple(outputs.equityReturn), accent: "neon" as const },
  ];

  return (
    <section>
      <SectionHeader
        eyebrow="Live project finance"
        title="Financial Scenario Engine"
        description="Move any assumption and watch IRR, NPV, EBITDA, payback, savings, carbon value and equity return recompute live across a 25-year model."
        actions={
          <button
            onClick={reset}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            ↺ Reset to base
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Inputs */}
        <Panel className="p-5 lg:col-span-4">
          <p className="label-eyebrow mb-4">Assumptions</p>
          <div className="flex flex-col gap-4">
            {SLIDERS.map((s) => (
              <Slider
                key={s.key}
                label={s.label}
                value={inputs[s.key]}
                min={s.min}
                max={s.max}
                step={s.step}
                unit={s.unit}
                onChange={(v) => update(s.key, v)}
              />
            ))}
          </div>
        </Panel>

        {/* Outputs + chart */}
        <div className="flex flex-col gap-5 lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {tiles.map((t, i) => (
              <OutputTile key={t.label} {...t} index={i} />
            ))}
          </div>

          <Panel index={1} className="p-5" grid>
            <div className="mb-3 flex items-center justify-between">
              <p className="label-eyebrow">Equity cashflow · 25-year</p>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-electric">
                  <span className="h-2 w-2 rounded-full bg-electric" /> Annual
                </span>
                <span className="flex items-center gap-1 text-neon">
                  <span className="h-2 w-2 rounded-full bg-neon" /> Cumulative
                </span>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={cashflows}
                  margin={{ top: 10, right: 10, left: -8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#39ff8b" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#39ff8b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1d2435" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={{ stroke: "#1d2435" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `£${(v / 1_000_000).toFixed(0)}m`}
                  />
                  <Tooltip content={<CashflowTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#39ff8b"
                    strokeWidth={2}
                    fill="url(#cumGrad)"
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    dataKey="cashflow"
                    stroke="#3da9ff"
                    strokeWidth={1.5}
                    dot={false}
                    animationDuration={500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
