import Link from "next/link";
import {
  CalendarClock,
  CheckSquare,
  Scale,
  Target,
  AlertTriangle,
  Sun,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/data/queries";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { PriorityBadge, RiskLevelBadge, DecisionStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const {
    tasks,
    meetings,
    decisions,
    risks,
    openOpps,
    pipelineValue,
    brief,
  } = await getDashboardData();

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";
  const greeting = greetingForNow();
  const priorities = [...tasks]
    .sort((a, b) => rank(b.priority) - rank(a.priority))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <p className="text-sm text-electric-400">Command Centre</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}{" "}
          · Here&apos;s where things stand today.
        </p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Open tasks"
          value={tasks.length}
          hint={`${tasks.filter((t) => t.status === "blocked").length} blocked`}
          icon={CheckSquare}
        />
        <StatCard
          label="Upcoming meetings"
          value={meetings.length}
          hint={meetings[0] ? `Next: ${formatTime(meetings[0].starts_at)}` : "None scheduled"}
          icon={CalendarClock}
          accent="emerald"
        />
        <StatCard
          label="Open pipeline"
          value={formatCurrency(pipelineValue)}
          hint={`${openOpps.length} live opportunities`}
          icon={Target}
        />
        <StatCard
          label="Open risks"
          value={risks.length}
          hint={`${risks.filter((r) => r.level === "high" || r.level === "critical").length} high / critical`}
          icon={AlertTriangle}
          accent="amber"
        />
      </div>

      {/* AI daily brief teaser */}
      <div className="rounded-xl border border-electric-500/30 bg-electric-500/[0.07] p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-electric-500/20">
              <Sun className="h-5 w-5 text-electric-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Today&apos;s AI Brief</p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {brief?.headline ??
                  "Your morning brief is ready — priorities, meetings, and the one risk to watch."}
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link href="/daily-brief">
              Read brief <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Section grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Priorities */}
        <SectionCard title="Today's priorities" icon={CheckSquare} href="/tasks">
          {priorities.length ? (
            <ul className="divide-y divide-border/60">
              {priorities.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="truncate text-sm">{t.title}</span>
                  <PriorityBadge value={t.priority} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No open tasks. Enjoy the clear runway.</Empty>
          )}
        </SectionCard>

        {/* Meetings */}
        <SectionCard title="Upcoming meetings" icon={CalendarClock} href="/meetings">
          {meetings.length ? (
            <ul className="divide-y divide-border/60">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{m.title}</p>
                    {m.location && (
                      <p className="truncate text-xs text-muted-foreground">
                        {m.location}
                      </p>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(m.starts_at)} · {formatTime(m.starts_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No upcoming meetings.</Empty>
          )}
        </SectionCard>

        {/* Decisions */}
        <SectionCard title="Recent decisions" icon={Scale} href="/decisions">
          {decisions.length ? (
            <ul className="divide-y divide-border/60">
              {decisions.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="truncate text-sm">{d.title}</span>
                  <DecisionStatusBadge value={d.status} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No decisions logged yet.</Empty>
          )}
        </SectionCard>

        {/* Risks */}
        <SectionCard title="Risks to watch" icon={AlertTriangle} href="/dashboard" hrefLabel="Live">
          {risks.length ? (
            <ul className="divide-y divide-border/60">
              {risks.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{r.title}</p>
                    {r.mitigation && (
                      <p className="truncate text-xs text-muted-foreground">
                        Mitigation: {r.mitigation}
                      </p>
                    )}
                  </div>
                  <RiskLevelBadge value={r.level} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No open risks flagged.</Empty>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

function rank(p: string) {
  return { critical: 3, high: 2, medium: 1, low: 0 }[p] ?? 0;
}

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
