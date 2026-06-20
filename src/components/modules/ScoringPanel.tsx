"use client";

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import { useOpportunityStore } from "@/store/useOpportunityStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { scoreColor, scoreBg, actionVariant } from "@/lib/display";
import { formatPercent } from "@/lib/utils";

export function ScoringPanel() {
  const { scoring } = useOpportunityStore();

  const radarData = scoring.categories.map((c) => ({
    category: c.label.replace(" value", "").replace(" viability", ""),
    score: Math.round(c.score),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Weighted opportunity score</CardTitle>
            <CardDescription>Seven categories, transparently weighted.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className={`text-6xl font-bold ${scoreColor(scoring.overall)}`}>
                {scoring.overall.toFixed(0)}
              </span>
              <div className="space-y-2">
                <Badge variant={actionVariant(scoring.recommendedAction)} className="px-3 py-1">
                  {scoring.recommendedAction}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Risk score {scoring.riskScore.toFixed(0)}/100
                </p>
              </div>
            </div>
            <div className="mt-6 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.35}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Category breakdown</CardTitle>
            <CardDescription>Each category is built from explainable sub-scores.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {scoring.categories.map((c) => (
              <div key={c.key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatPercent(c.weight, 0)} weight
                    </span>
                  </div>
                  <span className={`font-semibold ${scoreColor(c.score)}`}>{c.score.toFixed(0)}</span>
                </div>
                <Progress value={c.score} indicatorClassName={scoreBg(c.score)} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 pl-1">
                  {c.subScores.map((s) => (
                    <span key={s.label} className="text-[11px] text-muted-foreground">
                      {s.label}:{" "}
                      <span className={scoreColor(s.score)}>{s.score.toFixed(0)}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
