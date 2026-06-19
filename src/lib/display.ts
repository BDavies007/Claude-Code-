import type { RecommendedAction, PipelineStage } from "@/types";
import type { BadgeProps } from "@/components/ui/badge";

/** Map a recommended action to a badge variant. */
export function actionVariant(action: RecommendedAction): BadgeProps["variant"] {
  switch (action) {
    case "Reject":
      return "destructive";
    case "Watchlist":
      return "warning";
    case "Feasibility":
      return "secondary";
    case "Priority":
      return "accent";
    case "Strategic Flagship":
      return "default";
  }
}

/** Tailwind text colour class for a 0-100 score (red -> amber -> green). */
export function scoreColor(score: number): string {
  if (score >= 75) return "text-primary";
  if (score >= 60) return "text-accent";
  if (score >= 45) return "text-amber-400";
  return "text-destructive";
}

/** Tailwind background colour class for a 0-100 score, used for progress bars. */
export function scoreBg(score: number): string {
  if (score >= 75) return "bg-primary";
  if (score >= 60) return "bg-accent";
  if (score >= 45) return "bg-amber-400";
  return "bg-destructive";
}

/** Ordered list of pipeline stages for progression display. */
export const PIPELINE_STAGES: PipelineStage[] = [
  "Lead",
  "Qualified",
  "Desktop Assessment",
  "Feasibility",
  "Commercial Structuring",
  "Investment Committee",
  "Contracting",
  "Build",
  "Operational",
];

/** Colour for a risk heat-map cell given likelihood*impact (1-25). */
export function riskHeat(score: number): string {
  if (score >= 15) return "bg-destructive/80 text-destructive-foreground";
  if (score >= 9) return "bg-amber-500/70 text-black";
  if (score >= 5) return "bg-yellow-500/40 text-foreground";
  return "bg-primary/40 text-foreground";
}
