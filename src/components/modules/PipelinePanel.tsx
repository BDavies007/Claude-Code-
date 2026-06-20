"use client";

import { useMemo, useState } from "react";
import { PIPELINE } from "@/data/pipeline";
import { PIPELINE_STAGES, actionVariant, scoreColor } from "@/lib/display";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/MetricCard";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import type { PipelineStage } from "@/types";

export function PipelinePanel() {
  const [stageFilter, setStageFilter] = useState<PipelineStage | "All">("All");

  const filtered = useMemo(
    () => (stageFilter === "All" ? PIPELINE : PIPELINE.filter((p) => p.stage === stageFilter)),
    [stageFilter]
  );

  const totals = useMemo(
    () => ({
      mwp: PIPELINE.reduce((a, p) => a + p.mwpPotential, 0),
      bess: PIPELINE.reduce((a, p) => a + p.bessPotentialMWh, 0),
      savings: PIPELINE.reduce((a, p) => a + p.annualSavings, 0),
      carbon: PIPELINE.reduce((a, p) => a + p.carbonTonnesSaved, 0),
    }),
    []
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Pipeline solar" value={`${formatNumber(totals.mwp, 1)} MWp`} accent="primary" />
        <MetricCard label="Pipeline BESS" value={`${formatNumber(totals.bess, 1)} MWh`} accent="accent" />
        <MetricCard label="Annual client savings" value={formatCurrency(totals.savings, { compact: true })} accent="primary" />
        <MetricCard label="Carbon saved / yr" value={`${formatNumber(totals.carbon)} t`} accent="accent" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Opportunity pipeline</CardTitle>
            <CardDescription>{filtered.length} of {PIPELINE.length} opportunities</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Button size="sm" variant={stageFilter === "All" ? "default" : "outline"} onClick={() => setStageFilter("All")}>
              All
            </Button>
            {PIPELINE_STAGES.map((s) => (
              <Button key={s} size="sm" variant={stageFilter === s ? "default" : "outline"} onClick={() => setStageFilter(s)}>
                {s}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2">Lead</th>
                  <th className="px-3 py-2">Sector</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2 text-right">MWp</th>
                  <th className="px-3 py-2 text-right">BESS</th>
                  <th className="px-3 py-2 text-right">Savings/yr</th>
                  <th className="px-3 py-2 text-right">tCO₂/yr</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">IRR</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Next action</th>
                  <th className="px-3 py-2 text-center">Priority</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="px-3 py-2 font-medium">{p.leadName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.sector}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.country}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(p.mwpPotential, 1)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(p.bessPotentialMWh, 1)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(p.annualSavings, { compact: true })}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(p.carbonTonnesSaved)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${scoreColor(p.opportunityScore)}`}>
                      {p.opportunityScore}
                    </td>
                    <td className="px-3 py-2 text-right">{formatPercent(p.irr)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{p.stage}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.nextAction}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={actionVariant(p.recommendedAction)}>{p.recommendedAction}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
