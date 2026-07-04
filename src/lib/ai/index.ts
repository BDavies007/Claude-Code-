import type { AiProvider, BriefContext, BriefResult } from "./types";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

export type { BriefContext, BriefResult } from "./types";

/**
 * Provider abstraction: pick Anthropic or OpenAI if a key is configured,
 * otherwise fall back to a deterministic local brief so the app always
 * works out of the box (no keys required for the MVP demo).
 */
export function getProvider(): AiProvider {
  if (process.env.ANTHROPIC_API_KEY) return anthropicProvider;
  if (process.env.OPENAI_API_KEY) return openaiProvider;
  return mockProvider;
}

export async function generateDailyBrief(
  ctx: BriefContext,
): Promise<BriefResult> {
  try {
    return await getProvider().generateBrief(ctx);
  } catch {
    // Never fail the page on an AI hiccup — degrade to the local brief.
    return mockProvider.generateBrief(ctx);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────
function safeParse(text: string, provider: string): BriefResult {
  const match = text.match(/\{[\s\S]*\}/);
  const json = match ? JSON.parse(match[0]) : {};
  return {
    headline: json.headline ?? "Your executive brief",
    summary: json.summary ?? "",
    highlights: Array.isArray(json.highlights) ? json.highlights : [],
    provider,
  };
}

// ── Anthropic ───────────────────────────────────────────────────────
const anthropicProvider: AiProvider = {
  name: "anthropic",
  async generateBrief(ctx) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(ctx) }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text ?? "{}";
    return safeParse(text, "anthropic");
  },
};

// ── OpenAI ──────────────────────────────────────────────────────────
const openaiProvider: AiProvider = {
  name: "openai",
  async generateBrief(ctx) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(ctx) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "{}";
    return safeParse(text, "openai");
  },
};

// ── Mock (no API key required) ──────────────────────────────────────
const mockProvider: AiProvider = {
  name: "mock",
  async generateBrief(ctx) {
    const top = [...ctx.tasks].sort(
      (a, b) => rank(b.priority) - rank(a.priority),
    );
    const nextMeeting = ctx.meetings[0];
    const topRisk = [...ctx.risks].sort(
      (a, b) => rankRisk(b.level) - rankRisk(a.level),
    )[0];
    const liveOpps = ctx.opportunities.filter(
      (o) => o.stage !== "won" && o.stage !== "lost",
    );

    const highlights: string[] = [];
    if (top[0]) highlights.push(`Focus first on: ${top[0].title}`);
    if (nextMeeting)
      highlights.push(`Prep for your next meeting: ${nextMeeting.title}`);
    if (liveOpps[0])
      highlights.push(`Advance the pipeline: ${liveOpps[0].name}`);
    if (topRisk) highlights.push(`Watch this risk: ${topRisk.title}`);
    if (highlights.length === 0)
      highlights.push("A clear day — invest it in deep, proactive work.");

    const summary =
      `You have ${ctx.tasks.length} open task${ctx.tasks.length === 1 ? "" : "s"} and ` +
      `${ctx.meetings.length} upcoming meeting${ctx.meetings.length === 1 ? "" : "s"}. ` +
      (top[0]
        ? `Your highest-leverage move is "${top[0].title}". `
        : "") +
      (topRisk
        ? `Keep an eye on "${topRisk.title}" — it's the standing risk. `
        : "") +
      `Protect a block of deep work before the day fills up.`;

    return {
      headline: top[0]
        ? `Lead with ${top[0].title.toLowerCase()}`
        : `Your day at ${ctx.companyName}`,
      summary,
      highlights,
      provider: "mock",
    };
  },
};

function rank(p: string) {
  return { critical: 3, high: 2, medium: 1, low: 0 }[p] ?? 0;
}
function rankRisk(l: string) {
  return { critical: 3, high: 2, medium: 1, low: 0 }[l] ?? 0;
}
