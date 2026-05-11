import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Wallet, Users, Briefcase } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { currency } from "@/lib/format";
import type { CrmClient, ProjectRow, Transaction } from "@/types/atlas";

const PIPELINE_STAGES = ["Lead", "Qualified", "Proposal", "Onboarding", "Active"] as const;

export function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);

  useEffect(() => {
    Promise.all([
      window.atlas.db.finance.list(),
      window.atlas.db.crm.list(),
      window.atlas.db.projects.list(),
    ]).then(([t, c, p]) => {
      setTransactions(t);
      setClients(c);
      setProjects(p);
    });
  }, []);

  const metrics = useMemo(() => computeMetrics(transactions, clients, projects), [
    transactions,
    clients,
    projects,
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-fg-muted">
          KPIs computed live from your Finance, CRM, and Projects tables.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Income MTD"
          value={currency(metrics.incomeMonth)}
          hint={metrics.momLabel}
          tone={metrics.momTrend >= 0 ? "success" : "warn"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <Stat
          label="Cash on hand"
          value={currency(metrics.netCash)}
          hint={`Net of ${transactions.length} transactions`}
          tone={metrics.netCash >= 0 ? "default" : "danger"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <Stat
          label="Active clients"
          value={metrics.activeClients}
          hint={`${metrics.onboardingClients} onboarding · ${clients.length} total`}
          icon={<Users className="h-4 w-4" />}
        />
        <Stat
          label="Open projects"
          value={metrics.openProjects}
          hint={
            metrics.atRiskProjects > 0
              ? `${metrics.atRiskProjects} at risk or blocked`
              : "All on track"
          }
          tone={metrics.atRiskProjects > 0 ? "warn" : "success"}
          icon={<Briefcase className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by stage</CardTitle>
            <span className="text-xs text-fg-muted">
              Total weighted: {currency(metrics.pipelineValue)}
            </span>
          </CardHeader>
          <CardBody>
            {clients.length === 0 ? (
              <p className="text-sm text-fg-muted">
                No clients yet — add some on the Clients page to populate the pipeline.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {PIPELINE_STAGES.map((stage) => {
                  const items = clients.filter((c) => c.stage === stage);
                  const value = items.reduce((s, c) => s + c.value, 0);
                  return (
                    <li key={stage} className="rounded-lg border border-border bg-bg p-3">
                      <div className="text-xs uppercase tracking-wide text-fg-muted">{stage}</div>
                      <div className="mt-1 text-lg font-semibold">{items.length}</div>
                      <div className="text-xs text-fg-muted">{currency(value)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects by status</CardTitle>
            <span className="text-xs text-fg-muted">{projects.length} total</span>
          </CardHeader>
          <CardBody>
            {projects.length === 0 ? (
              <p className="text-sm text-fg-muted">
                No projects yet — add some on the Projects page.
              </p>
            ) : (
              <ul className="space-y-2">
                {(["On track", "At risk", "Blocked", "Done"] as const).map((status) => {
                  const items = projects.filter((p) => p.status === status);
                  if (items.length === 0) return null;
                  const pct = (items.length / projects.length) * 100;
                  return (
                    <li key={status}>
                      <div className="flex items-center justify-between text-sm">
                        <span>{status}</span>
                        <span className="text-fg-muted">{items.length}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                        <div
                          className={
                            "h-full " +
                            (status === "On track"
                              ? "bg-success"
                              : status === "At risk"
                                ? "bg-warn"
                                : status === "Blocked"
                                  ? "bg-danger"
                                  : "bg-fg-muted")
                          }
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cash flow — last 6 months</CardTitle>
          <span className="text-xs text-fg-muted">Income − expenses, by month</span>
        </CardHeader>
        <CardBody>
          {transactions.length === 0 ? (
            <p className="text-sm text-fg-muted">No transactions yet.</p>
          ) : (
            <CashflowBars data={metrics.monthlyNet} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function CashflowBars({ data }: { data: { label: string; net: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.net)));
  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((d) => {
        const heightPct = (Math.abs(d.net) / max) * 100;
        const positive = d.net >= 0;
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={
                "w-full rounded-t " + (positive ? "bg-success" : "bg-danger")
              }
              style={{ height: `${heightPct}%`, minHeight: "2px" }}
              title={`${d.label}: ${d.net.toLocaleString()}`}
            />
            <div className="text-[10px] uppercase tracking-wide text-fg-muted">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function computeMetrics(
  transactions: Transaction[],
  clients: CrmClient[],
  projects: ProjectRow[],
) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);

  const incomeMonth = transactions
    .filter((t) => t.date >= monthStart && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const incomeLast = transactions
    .filter((t) => t.date >= lastMonthStart && t.date < monthStart && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  const momTrend = incomeLast === 0 ? 0 : ((incomeMonth - incomeLast) / incomeLast) * 100;
  const momLabel =
    incomeLast === 0
      ? "Set a baseline"
      : `${momTrend >= 0 ? "+" : ""}${momTrend.toFixed(1)}% MoM`;

  const netCash = transactions.reduce((s, t) => s + t.amount, 0);

  const activeClients = clients.filter((c) =>
    ["Active", "Onboarding", "Proposal"].includes(c.stage),
  ).length;
  const onboardingClients = clients.filter((c) => c.stage === "Onboarding").length;

  const pipelineValue = clients
    .filter((c) => c.stage !== "Lost")
    .reduce((s, c) => s + c.value, 0);

  const openProjects = projects.filter((p) => p.status !== "Done").length;
  const atRiskProjects = projects.filter(
    (p) => p.status === "At risk" || p.status === "Blocked",
  ).length;

  const monthlyNet: { label: string; net: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString().slice(0, 10);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
    const net = transactions
      .filter((t) => t.date >= start && t.date < nextMonth)
      .reduce((s, t) => s + t.amount, 0);
    monthlyNet.push({ label: d.toLocaleString(undefined, { month: "short" }), net });
  }

  return {
    incomeMonth,
    momTrend,
    momLabel,
    netCash,
    activeClients,
    onboardingClients,
    pipelineValue,
    openProjects,
    atRiskProjects,
    monthlyNet,
  };
}
