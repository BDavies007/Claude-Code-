"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { useOpportunityStore } from "@/store/useOpportunityStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { actionVariant, scoreColor } from "@/lib/display";
import { formatCurrency, formatPercent } from "@/lib/utils";

export function ScenarioPanel() {
  const { scenarios, activeScenario, setScenario } = useOpportunityStore();

  const npvData = scenarios.map((s) => ({
    name: s.scenario.label,
    npv: Math.round(s.financial.riskAdjustedNpv),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scenario engine</CardTitle>
          <CardDescription>
            Select a scenario to drive the dashboard, or compare them side by side. Each perturbs
            prices, costs, carbon, load, financing, delay and curtailment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((s) => (
              <Button
                key={s.scenario.key}
                size="sm"
                variant={activeScenario === s.scenario.key ? "default" : "outline"}
                onClick={() => setScenario(s.scenario.key)}
              >
                {s.scenario.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk-adjusted NPV by scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={npvData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatCurrency(v, { compact: true })} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="npv" radius={[3, 3, 0, 0]}>
                  {npvData.map((d, i) => (
                    <Cell key={i} fill={d.npv >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scenario comparison</CardTitle>
          <CardDescription>Key outputs across all built-in scenarios.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">Scenario</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">IRR</th>
                <th className="px-3 py-2">NPV</th>
                <th className="px-3 py-2">RA-NPV</th>
                <th className="px-3 py-2">Payback</th>
                <th className="px-3 py-2">25yr revenue</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr
                  key={s.scenario.key}
                  className={`border-b border-border/50 ${
                    activeScenario === s.scenario.key ? "bg-secondary/40" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-left">
                    <div className="font-medium">{s.scenario.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.scenario.description}</div>
                  </td>
                  <td className={`px-3 py-2 font-semibold ${scoreColor(s.scoring.overall)}`}>
                    {s.scoring.overall.toFixed(0)}
                  </td>
                  <td className="px-3 py-2">{isFinite(s.financial.irr) ? formatPercent(s.financial.irr) : "n/a"}</td>
                  <td className="px-3 py-2">{formatCurrency(s.financial.npv, { compact: true })}</td>
                  <td className="px-3 py-2">{formatCurrency(s.financial.riskAdjustedNpv, { compact: true })}</td>
                  <td className="px-3 py-2">
                    {isFinite(s.financial.paybackYears) ? `${s.financial.paybackYears.toFixed(1)}y` : ">term"}
                  </td>
                  <td className="px-3 py-2">{formatCurrency(s.financial.totalRevenue25yr, { compact: true })}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={actionVariant(s.scoring.recommendedAction)}>
                      {s.scoring.recommendedAction}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
