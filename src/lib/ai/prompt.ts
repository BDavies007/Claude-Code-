import type { BriefContext } from "./types";
import { formatDate } from "@/lib/utils";

/** The system instruction shared by every provider. */
export const SYSTEM_PROMPT = `You are Amelia, the Chief of Staff inside "Executive OS", an AI command centre for a CEO.
Write a crisp, high-signal morning brief. Be direct and decision-oriented — no fluff, no hedging.
Return ONLY valid JSON matching this shape:
{ "headline": string, "summary": string (2-4 sentences), "highlights": string[] (3-5 short imperative bullets) }`;

/** Build the user prompt from the day's structured context. */
export function buildUserPrompt(ctx: BriefContext): string {
  const tasks = ctx.tasks
    .slice(0, 10)
    .map(
      (t) =>
        `- [${t.priority}/${t.status}] ${t.title}${t.due_date ? ` (due ${formatDate(t.due_date)})` : ""}`,
    )
    .join("\n");

  const meetings = ctx.meetings
    .slice(0, 8)
    .map((m) => `- ${m.title} at ${formatDate(m.starts_at)}`)
    .join("\n");

  const risks = ctx.risks
    .slice(0, 8)
    .map((r) => `- [${r.level}] ${r.title}`)
    .join("\n");

  const opps = ctx.opportunities
    .filter((o) => o.stage !== "won" && o.stage !== "lost")
    .slice(0, 8)
    .map((o) => `- ${o.name} [${o.stage}] ${o.value ?? ""} ${o.currency}`)
    .join("\n");

  return `CEO: ${ctx.fullName} · Company: ${ctx.companyName} · Date: ${ctx.date}

OPEN TASKS:
${tasks || "(none)"}

UPCOMING MEETINGS:
${meetings || "(none)"}

OPEN RISKS:
${risks || "(none)"}

LIVE OPPORTUNITIES:
${opps || "(none)"}

Write the brief now.`;
}
