/**
 * The default AI staff roster. Seeded per-user in the database, but also used
 * as a fallback so the Agents page is always populated for new accounts.
 */
export interface AgentDef {
  name: string;
  role: string;
  description: string;
  accent: string;
  status: string;
}

export const DEFAULT_AGENTS: AgentDef[] = [
  {
    name: "Amelia",
    role: "Chief of Staff",
    description:
      "Orchestrates your day, drafts the daily brief, and keeps priorities aligned across the team.",
    accent: "electric",
    status: "active",
  },
  {
    name: "Atlas",
    role: "Strategy & Decisions",
    description:
      "Frames major decisions, weighs options, and pressure-tests strategy against your goals.",
    accent: "indigo",
    status: "active",
  },
  {
    name: "Orbit",
    role: "Relationships & CRM",
    description:
      "Tracks contacts and companies, surfaces who to reconnect with, and preps meeting context.",
    accent: "sky",
    status: "active",
  },
  {
    name: "Sentinel",
    role: "Risk & Compliance",
    description:
      "Monitors operational, financial, and market risks and flags what needs attention.",
    accent: "amber",
    status: "active",
  },
  {
    name: "Forge",
    role: "Execution & Tasks",
    description:
      "Turns decisions into tasks, chases owners, and keeps commitments moving to done.",
    accent: "emerald",
    status: "active",
  },
  {
    name: "Vector",
    role: "Growth & Pipeline",
    description:
      "Analyses opportunities, forecasts the pipeline, and highlights the highest-leverage deals.",
    accent: "violet",
    status: "active",
  },
  {
    name: "Pulse",
    role: "Insights & Reporting",
    description:
      "Synthesises company metrics into board-ready insight and tracks progress to goals.",
    accent: "rose",
    status: "idle",
  },
];

/** Tailwind classes for each agent accent colour. */
export const ACCENT_CLASSES: Record<string, string> = {
  electric: "bg-electric-500/15 text-electric-400 ring-electric-500/30",
  indigo: "bg-indigo-500/15 text-indigo-400 ring-indigo-500/30",
  sky: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
  amber: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  emerald: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  violet: "bg-violet-500/15 text-violet-400 ring-violet-500/30",
  rose: "bg-rose-500/15 text-rose-400 ring-rose-500/30",
};
