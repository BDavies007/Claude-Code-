"use client";

import { motion } from "framer-motion";
import {
  alerts,
  blockedProjects,
  criticalDecisions,
  investorMetrics,
  opportunities,
  teamActions,
} from "@/data/ceo";
import type { Priority } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";
import { formatCurrency } from "@/lib/format";
import { useViewMode } from "@/components/providers/ViewModeProvider";

const priorityTone: Record<Priority, "danger" | "warn" | "teal"> = {
  critical: "danger",
  high: "warn",
  medium: "teal",
};

export function CommandCentre() {
  const { mode } = useViewMode();
  const blockedValue = blockedProjects.reduce((a, p) => a + p.value, 0);
  const oppValue = opportunities.reduce((a, p) => a + p.value, 0);

  return (
    <section>
      <SectionHeader
        eyebrow="CEO cockpit"
        title="Command Centre"
        description={
          mode === "investor"
            ? "Investor lens — capital, returns and portfolio headline metrics first."
            : mode === "client"
              ? "Client lens — delivery confidence and service outcomes."
              : mode === "operations"
                ? "Operations lens — blockers, alerts and team actions front and centre."
                : "Critical decisions, blocked value, opportunities, cash impact, risk alerts and the team's next moves — at a glance."
        }
      />

      {/* Headline cash + alert strip */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-4" index={0}>
          <p className="label-eyebrow">Blocked value</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-danger">
            {formatCurrency(blockedValue, { compact: true })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {blockedProjects.length} projects need intervention
          </p>
        </Panel>
        <Panel className="p-4" index={1}>
          <p className="label-eyebrow">Opportunity value</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-neon">
            {formatCurrency(oppValue, { compact: true })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            top {opportunities.length} weighted opportunities
          </p>
        </Panel>
        <Panel className="p-4" index={2}>
          <p className="label-eyebrow">Critical decisions</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-warn">
            {criticalDecisions.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">awaiting CEO sign-off</p>
        </Panel>
        <Panel className="p-4" index={3}>
          <p className="label-eyebrow">Risk alerts</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-electric">
            {alerts.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">live across the group</p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Critical decisions */}
        <Panel className="p-5" index={0}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Critical decisions</h3>
            <Badge tone="danger">Action</Badge>
          </div>
          <div className="flex flex-col gap-3">
            {criticalDecisions.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-white/5 bg-base-700/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white">{d.title}</p>
                  <Badge tone={priorityTone[d.priority]}>{d.priority}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">{d.context}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Owner · {d.owner}</span>
                  <span className="font-mono text-slate-300">Due {d.due}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Blocked + opportunities */}
        <div className="flex flex-col gap-5">
          <Panel className="p-5" index={1}>
            <h3 className="mb-3 text-sm font-semibold text-white">
              Blocked projects
            </h3>
            <div className="flex flex-col gap-2">
              {blockedProjects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-danger/15 bg-danger/5 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-white">{p.name}</p>
                    <p className="text-[11px] text-slate-400">{p.reason}</p>
                  </div>
                  <span className="font-mono text-xs text-danger">
                    {formatCurrency(p.value, { compact: true })}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5" index={2}>
            <h3 className="mb-3 text-sm font-semibold text-white">
              Highest-value opportunities
            </h3>
            <div className="flex flex-col gap-2">
              {opportunities.map((o) => (
                <div key={o.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white">{o.title}</span>
                    <span className="font-mono text-neon">
                      {formatCurrency(o.value, { compact: true })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${o.probability}%` }}
                        transition={{ duration: 0.6 }}
                        className="h-full rounded-full bg-gradient-to-r from-electric to-neon"
                      />
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      {o.probability}% · {o.mwp}MWp
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Alerts + team actions */}
        <div className="flex flex-col gap-5">
          <Panel className="p-5" index={3}>
            <h3 className="mb-3 text-sm font-semibold text-white">Risk alerts</h3>
            <div className="flex flex-col gap-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2 rounded-lg border border-white/5 bg-base-700/40 px-3 py-2"
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 animate-pulse-glow rounded-full ${
                      a.severity === "critical"
                        ? "bg-danger"
                        : a.severity === "high"
                          ? "bg-warn"
                          : "bg-teal"
                    }`}
                  />
                  <div>
                    <p className="text-xs text-slate-200">{a.message}</p>
                    <p className="text-[10px] text-slate-500">{a.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5" index={4}>
            <h3 className="mb-3 text-sm font-semibold text-white">Team actions</h3>
            <div className="flex flex-col gap-2">
              {teamActions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        t.status === "done"
                          ? "bg-neon"
                          : t.status === "in-progress"
                            ? "bg-electric"
                            : "bg-slate-600"
                      }`}
                    />
                    <span className="text-slate-200">{t.action}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    {t.owner} · {t.due}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Investor-ready metrics */}
      <Panel className="mt-5 p-5" index={5} grid>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Investor-ready metrics
          </h3>
          <Badge tone="teal">Board pack</Badge>
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {investorMetrics.map((m) => (
            <Stat
              key={m.label}
              label={m.label}
              value={m.value}
              delta={m.sub}
              trend={m.trend}
              accent="teal"
            />
          ))}
        </div>
      </Panel>
    </section>
  );
}
