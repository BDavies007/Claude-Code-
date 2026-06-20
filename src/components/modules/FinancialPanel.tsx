"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useOpportunityStore } from "@/store/useOpportunityStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NumberField } from "@/components/shared/Field";
import { MetricCard } from "@/components/shared/MetricCard";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";

export function FinancialPanel() {
  const { financial, global, updateGlobal } = useOpportunityStore();

  const chartData = financial.cashFlows.map((c) => ({
    year: c.year,
    "Net cash flow": Math.round(c.netCashFlow),
    "Cumulative": Math.round(c.cumulativeCashFlow),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Total capex" value={formatCurrency(financial.capex, { compact: true })} accent="muted" />
        <MetricCard
          label="NPV / Risk-adj NPV"
          value={formatCurrency(financial.npv, { compact: true })}
          sub={`RA: ${formatCurrency(financial.riskAdjustedNpv, { compact: true })}`}
          accent={financial.npv >= 0 ? "primary" : "destructive"}
        />
        <MetricCard label="IRR" value={isFinite(financial.irr) ? formatPercent(financial.irr) : "n/a"} accent="primary" />
        <MetricCard
          label="Payback"
          value={isFinite(financial.paybackYears) ? `${financial.paybackYears.toFixed(1)} yrs` : ">term"}
          accent="muted"
        />
      </div>

      {/* Editable global assumptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global financial assumptions</CardTitle>
          <CardDescription>Adjust the financing structure — the model recomputes instantly.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <NumberField label="Discount rate" suffix="frac" step={0.005} value={global.discountRate} onChange={(v) => updateGlobal({ discountRate: v })} />
            <NumberField label="Inflation" suffix="frac" step={0.005} value={global.inflation} onChange={(v) => updateGlobal({ inflation: v })} />
            <NumberField label="Dev margin" suffix="£/kWh" step={0.001} value={global.developerMarginPerKwh} onChange={(v) => updateGlobal({ developerMarginPerKwh: v })} />
            <NumberField label="Debt ratio" suffix="frac" step={0.05} value={global.debtRatio} onChange={(v) => updateGlobal({ debtRatio: v })} />
            <NumberField label="Debt cost" suffix="frac" step={0.005} value={global.debtCostRate} onChange={(v) => updateGlobal({ debtCostRate: v })} />
            <NumberField label="Debt term" suffix="years" value={global.debtTermYears} onChange={(v) => updateGlobal({ debtTermYears: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Cash flow chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equity cash flow profile</CardTitle>
          <CardDescription>Annual net cash flow and cumulative position.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatCurrency(v, { compact: true })} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Net cash flow" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="Cumulative" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cash flow table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed cash flows</CardTitle>
          <CardDescription>First 10 years shown; full schedule available on export.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 text-left">Yr</th>
                <th className="px-2 py-2">Gen (MWh)</th>
                <th className="px-2 py-2">PPA</th>
                <th className="px-2 py-2">Carbon</th>
                <th className="px-2 py-2">Flex+BESS</th>
                <th className="px-2 py-2">Opex</th>
                <th className="px-2 py-2">EBITDA</th>
                <th className="px-2 py-2">Net CF</th>
                <th className="px-2 py-2">DSCR</th>
              </tr>
            </thead>
            <tbody>
              {financial.cashFlows.slice(0, 10).map((c) => (
                <tr key={c.year} className="border-b border-border/50">
                  <td className="px-2 py-1.5 text-left font-medium">{c.year}</td>
                  <td className="px-2 py-1.5">{formatNumber(c.generationMWh)}</td>
                  <td className="px-2 py-1.5">{formatCurrency(c.ppaRevenue, { compact: true })}</td>
                  <td className="px-2 py-1.5">{formatCurrency(c.carbonValue, { compact: true })}</td>
                  <td className="px-2 py-1.5">{formatCurrency(c.flexibilityRevenue + c.bessArbitrage, { compact: true })}</td>
                  <td className="px-2 py-1.5">{formatCurrency(c.opex, { compact: true })}</td>
                  <td className="px-2 py-1.5">{formatCurrency(c.ebitda, { compact: true })}</td>
                  <td className="px-2 py-1.5">{formatCurrency(c.netCashFlow, { compact: true })}</td>
                  <td className="px-2 py-1.5">{isFinite(c.dscr) ? c.dscr.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
