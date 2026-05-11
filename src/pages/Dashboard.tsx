import { TrendingUp, Wallet, Users, Briefcase } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { currency } from "@/lib/format";

export function Dashboard() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-fg-muted">Cross-business KPIs at a glance.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={currency(28450)} hint="+8.2% MoM" tone="success" icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="Cash on hand" value={currency(142300)} hint="3 accounts" icon={<Wallet className="h-4 w-4" />} />
        <Stat label="Active clients" value={17} hint="2 onboarding" icon={<Users className="h-4 w-4" />} />
        <Stat label="Open projects" value={6} hint="2 at risk" tone="warn" icon={<Briefcase className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline by stage</CardTitle>
          <span className="text-xs text-fg-muted">Placeholder — wire to CRM data</span>
        </CardHeader>
        <CardBody>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { stage: "Lead", count: 12, value: 38000 },
              { stage: "Qualified", count: 7, value: 92000 },
              { stage: "Proposal", count: 4, value: 145000 },
              { stage: "Won (MTD)", count: 3, value: 71000 },
            ].map((s) => (
              <li key={s.stage} className="rounded-lg border border-border bg-bg p-3">
                <div className="text-xs uppercase tracking-wide text-fg-muted">{s.stage}</div>
                <div className="mt-1 text-lg font-semibold">{s.count}</div>
                <div className="text-xs text-fg-muted">{currency(s.value)}</div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
