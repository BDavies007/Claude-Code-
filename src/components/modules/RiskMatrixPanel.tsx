"use client";

import { RISK_MATRIX } from "@/data/riskMatrix";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { riskHeat } from "@/lib/display";
import { cn } from "@/lib/utils";

export function RiskMatrixPanel() {
  // Build a 5x5 heat-map grid; cells reference risks landing on that coordinate.
  const grid: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const r of RISK_MATRIX) {
    grid[5 - r.impact][r.likelihood - 1] += 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Risk Matrix</h2>
        <p className="text-sm text-muted-foreground">
          Project risk register with a likelihood × impact heat-map and mitigations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Likelihood × Impact</CardTitle>
            <CardDescription>Count of risks per cell.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex">
              <div className="flex flex-col justify-around pr-2 text-[10px] text-muted-foreground">
                {[5, 4, 3, 2, 1].map((i) => (
                  <span key={i} className="h-12 flex items-center">I{i}</span>
                ))}
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-5 gap-1">
                  {grid.map((row, ri) =>
                    row.map((count, ci) => {
                      const impact = 5 - ri;
                      const likelihood = ci + 1;
                      return (
                        <div
                          key={`${ri}-${ci}`}
                          className={cn(
                            "flex h-12 items-center justify-center rounded text-sm font-semibold",
                            riskHeat(impact * likelihood)
                          )}
                        >
                          {count > 0 ? count : ""}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="mt-1 grid grid-cols-5 gap-1 text-center text-[10px] text-muted-foreground">
                  {[1, 2, 3, 4, 5].map((l) => (
                    <span key={l}>L{l}</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Rows = impact (I), columns = likelihood (L), both 1 (low) to 5 (high).
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Risk register</CardTitle>
            <CardDescription>{RISK_MATRIX.length} tracked risks with mitigations.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Risk</th>
                  <th className="px-2 py-2 text-center">L</th>
                  <th className="px-2 py-2 text-center">I</th>
                  <th className="px-2 py-2 text-center">Score</th>
                  <th className="px-2 py-2">Mitigation</th>
                </tr>
              </thead>
              <tbody>
                {[...RISK_MATRIX]
                  .sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact)
                  .map((r) => {
                    const score = r.likelihood * r.impact;
                    return (
                      <tr key={r.id} className="border-b border-border/50 align-top">
                        <td className="px-2 py-2">
                          <Badge variant="secondary">{r.category}</Badge>
                        </td>
                        <td className="px-2 py-2 text-xs">{r.risk}</td>
                        <td className="px-2 py-2 text-center">{r.likelihood}</td>
                        <td className="px-2 py-2 text-center">{r.impact}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", riskHeat(score))}>
                            {score}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-[11px] text-muted-foreground">{r.mitigation}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
