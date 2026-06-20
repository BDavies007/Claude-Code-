"use client";

import {
  Activity,
  BadgePoundSterling,
  BatteryCharging,
  CalendarClock,
  Gauge,
  Leaf,
  LineChart,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useOpportunityStore } from "@/store/useOpportunityStore";
import { MetricCard } from "@/components/shared/MetricCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { actionVariant, scoreColor } from "@/lib/display";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";

export function ExecutiveDashboard() {
  const { financial, scoring, input } = useOpportunityStore();

  const gaugeData = [{ name: "score", value: scoring.overall, fill: "hsl(var(--primary))" }];

  const revenueChartData = financial.cashFlows.map((c) => ({
    year: c.year,
    PPA: Math.round(c.ppaRevenue),
    Carbon: Math.round(c.carbonValue),
    Flexibility: Math.round(c.flexibilityRevenue + c.bessArbitrage),
    Export: Math.round(c.exportRevenue),
  }));

  return (
    <div className="space-y-6">
      {/* Headline: score gauge + recommendation */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Total Opportunity Score</CardTitle>
            <CardDescription>{input.client.companyName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="70%"
                  outerRadius="100%"
                  data={gaugeData}
                  startAngle={220}
                  endAngle={-40}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={12} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-bold ${scoreColor(scoring.overall)}`}>
                  {scoring.overall.toFixed(0)}
                </span>
                <span className="text-xs text-muted-foreground">out of 100</span>
              </div>
            </div>
            <div className="mt-2 flex flex-col items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Recommended action
              </span>
              <Badge variant={actionVariant(scoring.recommendedAction)} className="text-sm px-3 py-1">
                {scoring.recommendedAction}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Financial attractiveness"
            value={`${scoring.financialAttractiveness.toFixed(0)}/100`}
            icon={TrendingUp}
            accent="primary"
          />
          <MetricCard
            label="Carbon impact"
            value={`${scoring.carbonImpact.toFixed(0)}/100`}
            sub={`${formatNumber(financial.totalCarbonTonnes)} tCO₂ lifetime`}
            icon={Leaf}
            accent="accent"
          />
          <MetricCard
            label="Grid / flexibility value"
            value={`${scoring.gridFlexibilityValue.toFixed(0)}/100`}
            icon={BatteryCharging}
            accent="accent"
          />
          <MetricCard
            label="Risk-adjusted NPV"
            value={formatCurrency(financial.riskAdjustedNpv, { compact: true })}
            sub={`Base NPV ${formatCurrency(financial.npv, { compact: true })}`}
            icon={ShieldCheck}
            accent={financial.riskAdjustedNpv >= 0 ? "primary" : "destructive"}
          />
          <MetricCard
            label="Project IRR"
            value={isFinite(financial.irr) ? formatPercent(financial.irr) : "n/a"}
            icon={LineChart}
            accent="primary"
          />
          <MetricCard
            label="Payback period"
            value={isFinite(financial.paybackYears) ? `${financial.paybackYears.toFixed(1)} yrs` : ">term"}
            icon={CalendarClock}
            accent="muted"
          />
        </div>
      </div>

      {/* Secondary metric row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          label="Client savings / yr"
          value={formatCurrency(financial.clientBenefitPerYear, { compact: true })}
          icon={PiggyBank}
          accent="primary"
        />
        <MetricCard
          label="Investor return (IRR)"
          value={isFinite(financial.irr) ? formatPercent(financial.irr) : "n/a"}
          icon={Wallet}
          accent="accent"
        />
        <MetricCard
          label="25-yr total revenue"
          value={formatCurrency(financial.totalRevenue25yr, { compact: true })}
          icon={BadgePoundSterling}
          accent="muted"
        />
        <MetricCard
          label="Lightsummit margin / yr"
          value={formatCurrency(financial.lightsummitRecurringMargin, { compact: true })}
          sub="Recurring developer margin"
          icon={Activity}
          accent="primary"
        />
        <MetricCard
          label="Lifetime generation"
          value={`${formatNumber(financial.lifetimeGenerationMWh)} MWh`}
          icon={Zap}
          accent="accent"
        />
        <MetricCard
          label="Min DSCR"
          value={isFinite(financial.minDscr) ? financial.minDscr.toFixed(2) : "n/a"}
          sub={isFinite(financial.avgDscr) ? `Avg ${financial.avgDscr.toFixed(2)}` : undefined}
          icon={Gauge}
          accent={financial.minDscr >= 1.3 ? "primary" : "warning"}
        />
      </div>

      {/* Revenue stack over time */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue stack over PPA term</CardTitle>
          <CardDescription>
            Diversified income: PPA energy, carbon value, flexibility & arbitrage, and export.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {["PPA", "Carbon", "Flexibility", "Export"].map((k, i) => (
                    <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={["#22c55e", "#0ea5e9", "#f59e0b", "#a78bfa"][i]}
                        stopOpacity={0.7}
                      />
                      <stop
                        offset="95%"
                        stopColor={["#22c55e", "#0ea5e9", "#f59e0b", "#a78bfa"][i]}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => formatCurrency(v, { compact: true })}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatCurrency(v)}
                  labelFormatter={(l) => `Year ${l}`}
                />
                {["PPA", "Carbon", "Flexibility", "Export"].map((k) => (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stackId="1"
                    stroke={
                      { PPA: "#22c55e", Carbon: "#0ea5e9", Flexibility: "#f59e0b", Export: "#a78bfa" }[k]
                    }
                    fill={`url(#grad-${k})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
