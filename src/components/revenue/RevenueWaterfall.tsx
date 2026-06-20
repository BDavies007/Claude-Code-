"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { revenueScenarios, revenueStreams } from "@/data/revenue";
import type { ScenarioKey } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Panel } from "@/components/ui/Panel";
import { formatMillions } from "@/lib/format";

const accentHex = {
  neon: "#39ff8b",
  teal: "#1fe0c8",
  electric: "#3da9ff",
};

interface WaterfallBar {
  label: string;
  base: number; // invisible offset
  value: number;
  cumulative: number;
  color: string;
  isTotal?: boolean;
}

function buildWaterfall(scenario: ScenarioKey): WaterfallBar[] {
  let running = 0;
  const bars: WaterfallBar[] = revenueStreams.map((s) => {
    const value = s.values[scenario];
    const base = running;
    running += value;
    return {
      label: s.label,
      base,
      value,
      cumulative: running,
      color: accentHex[s.accent],
    };
  });
  bars.push({
    label: "Total",
    base: 0,
    value: running,
    cumulative: running,
    color: "#ffffff",
    isTotal: true,
  });
  return bars;
}

function WaterfallTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: WaterfallBar = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-base-800/95 px-3 py-2 text-xs shadow-panel backdrop-blur">
      <p className="font-semibold text-white">{d.label}</p>
      <p className="font-mono text-neon">{formatMillions(d.value)}</p>
      {!d.isTotal && (
        <p className="text-slate-400">Cumulative {formatMillions(d.cumulative)}</p>
      )}
    </div>
  );
}

export function RevenueWaterfall() {
  const [scenario, setScenario] = useState<ScenarioKey>("base");

  const data = useMemo(() => buildWaterfall(scenario), [scenario]);
  const total = data[data.length - 1].value;

  return (
    <section>
      <SectionHeader
        eyebrow="Group revenue build"
        title="Revenue Waterfall"
        description="Eight monetisation streams stacked from developer fees to carbon credits. Toggle scenarios to stress the plan."
        actions={
          <div className="flex items-center rounded-full border border-white/5 bg-base-800/60 p-1">
            {revenueScenarios.map((s) => (
              <button
                key={s.key}
                onClick={() => setScenario(s.key)}
                title={s.description}
                className={`relative rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  scenario === s.key ? "text-base-900" : "text-slate-400"
                }`}
              >
                {scenario === s.key && (
                  <motion.div
                    layoutId="revenue-scenario"
                    className="absolute inset-0 rounded-full bg-neon shadow-glow"
                  />
                )}
                <span className="relative z-10">{s.label}</span>
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-2" grid>
          <div className="mb-4 flex items-baseline justify-between">
            <p className="label-eyebrow">£m contribution</p>
            <p className="font-mono text-2xl font-semibold text-neon">
              {formatMillions(total)}
            </p>
          </div>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -16, bottom: 40 }}
              >
                <XAxis
                  dataKey="label"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={{ stroke: "#1d2435" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<WaterfallTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                {/* Invisible base to create the floating waterfall effect */}
                <Bar dataKey="base" stackId="w" fill="transparent" />
                <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]} animationDuration={600}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} fillOpacity={d.isTotal ? 1 : 0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel index={1} className="flex flex-col gap-3 p-5">
          <p className="label-eyebrow">Stream contribution</p>
          {revenueStreams
            .slice()
            .sort((a, b) => b.values[scenario] - a.values[scenario])
            .map((s) => {
              const v = s.values[scenario];
              const pct = (v / total) * 100;
              return (
                <div key={s.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{s.label}</span>
                    <span className="font-mono text-slate-200">
                      {formatMillions(v)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: accentHex[s.accent] }}
                    />
                  </div>
                </div>
              );
            })}
        </Panel>
      </div>
    </section>
  );
}
