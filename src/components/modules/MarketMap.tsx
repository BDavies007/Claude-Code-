"use client";

import { MARKET_PROFILES } from "@/data/marketProfiles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { scoreColor, scoreBg } from "@/lib/display";

const METRICS: { key: keyof (typeof MARKET_PROFILES)[number]; label: string }[] = [
  { key: "marketAttractiveness", label: "Market attractiveness" },
  { key: "gridConstraintSeverity", label: "Grid constraint severity" },
  { key: "ppaMaturity", label: "PPA maturity" },
  { key: "carbonEsgPressure", label: "Carbon / ESG pressure" },
  { key: "bessOpportunity", label: "BESS opportunity" },
  { key: "regulatoryComplexity", label: "Regulatory complexity" },
];

export function MarketMap() {
  const ranked = [...MARKET_PROFILES].sort((a, b) => b.marketAttractiveness - a.marketAttractiveness);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">European Market Opportunity Map</h2>
        <p className="text-sm text-muted-foreground">
          House view of nine European markets, ranked by attractiveness with recommended entry strategy.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ranked.map((m) => (
          <Card key={m.country}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{m.country}</CardTitle>
                <span className={`text-2xl font-bold ${scoreColor(m.marketAttractiveness)}`}>
                  {m.marketAttractiveness}
                </span>
              </div>
              <CardDescription>Attractiveness score</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {METRICS.map((metric) => {
                const value = m[metric.key] as number;
                return (
                  <div key={metric.key} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{metric.label}</span>
                      <span className={scoreColor(value)}>{value}</span>
                    </div>
                    <Progress value={value} indicatorClassName={scoreBg(value)} />
                  </div>
                );
              })}
              <div className="rounded-md border border-border bg-secondary/30 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recommended entry strategy
                </p>
                <p className="mt-1 text-xs leading-relaxed">{m.entryStrategy}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
