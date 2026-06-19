import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: "primary" | "accent" | "warning" | "destructive" | "muted";
}

const accentMap: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  primary: "text-primary",
  accent: "text-accent",
  warning: "text-amber-400",
  destructive: "text-destructive",
  muted: "text-foreground",
};

export function MetricCard({ label, value, sub, icon: Icon, accent = "muted" }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {Icon && <Icon className={cn("h-4 w-4 shrink-0", accentMap[accent])} />}
        </div>
        <p className={cn("mt-2 text-2xl font-bold tracking-tight", accentMap[accent])}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
