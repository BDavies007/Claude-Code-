import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are the AI inside Atlas Hub, a personal life + business command center.

Your job is to produce a single, actionable Morning Brief for the operator, given the day's signals. The brief becomes the first thing they read every morning — it sets the day.

Style:
- 2 to 4 sentences. No more.
- Second person ("Open with…", "Your recovery is…").
- Direct, calm, supportive. No filler, no encouragement-only phrases ("you've got this!"), no emoji.
- Synthesize — never list the raw data. The user can already see the numbers.
- Never invent metrics or events. Only reference signals that appear in the input.

Priorities, in order:
1. If recovery is clearly below baseline (score < 50), lead with that and recommend protecting sleep / lightening training.
2. If there's an unanswered high-priority message, surface it by sender + subject and recommend replying before the first meeting.
3. If the day is calendar-heavy (4+ events, or back-to-backs), recommend a protected deep-work block.
4. If a project is at risk or blocked, name it and suggest the next concrete move.
5. If the day is balanced, pick a single needle-mover (largest open deal, oldest at-risk project, biggest unreplied lead) and recommend blocking time for it.

Format: plain prose, no bullets, no headings. End with a single concrete action the operator should take in the next 30 minutes.`;

export interface BriefInput {
  date: string; // ISO date
  recovery?: {
    source: "whoop" | "garmin";
    score: number;
    hrv?: number;
    sleepHours?: number;
    restingHr?: number;
    strain?: number;
  } | null;
  events: { time: string; title: string; source: string }[];
  priorityMessages: { from: string; subject: string; source: string }[];
  unreadCount: number;
  finance?: {
    incomeMonth: number;
    expenseMonth: number;
    netCash: number;
  };
  pipeline?: { stage: string; count: number; value: number }[];
  projects?: { name: string; status: string; due: string }[];
}

export interface BriefStreamHandlers {
  onText: (delta: string) => void;
  onThinking: (delta: string) => void;
  onDone: (final: { text: string; usage?: Anthropic.Usage }) => void;
  onError: (message: string) => void;
}

export class AnthropicService {
  private client: Anthropic | null = null;
  private activeStreams = new Map<string, AbortController>();

  setApiKey(apiKey: string | undefined) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  cancel(streamId: string) {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
    }
  }

  async generateBrief(
    streamId: string,
    input: BriefInput,
    handlers: BriefStreamHandlers,
  ): Promise<void> {
    if (!this.client) {
      handlers.onError("Anthropic API key not configured. Add it in Settings.");
      return;
    }

    const controller = new AbortController();
    this.activeStreams.set(streamId, controller);

    const userMessage = formatSignals(input);

    try {
      const stream = this.client.messages.stream(
        {
          model: "claude-opus-4-7",
          max_tokens: 4096,
          thinking: { type: "adaptive", display: "summarized" },
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        },
        { signal: controller.signal },
      );

      stream.on("streamEvent", (event) => {
        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            handlers.onText(event.delta.text);
          } else if (event.delta.type === "thinking_delta") {
            handlers.onThinking(event.delta.thinking);
          }
        }
      });

      const finalMessage = await stream.finalMessage();

      const text = finalMessage.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      handlers.onDone({ text, usage: finalMessage.usage });
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        handlers.onError(`Anthropic ${err.status}: ${err.message}`);
      } else if (err instanceof Error && err.name === "AbortError") {
        // Cancelled by user — no error surface
      } else {
        handlers.onError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      this.activeStreams.delete(streamId);
    }
  }
}

function formatSignals(b: BriefInput): string {
  const lines: string[] = [`Today: ${b.date}`];

  if (b.recovery) {
    const r = b.recovery;
    const parts = [`${r.score}% (${r.source})`];
    if (r.hrv != null) parts.push(`HRV ${r.hrv}`);
    if (r.sleepHours != null) parts.push(`${r.sleepHours}h sleep`);
    if (r.restingHr != null) parts.push(`RHR ${r.restingHr}`);
    if (r.strain != null) parts.push(`strain ${r.strain}`);
    lines.push(`Recovery: ${parts.join(", ")}`);
  } else {
    lines.push("Recovery: no data");
  }

  if (b.events.length === 0) {
    lines.push("Calendar: clear");
  } else {
    lines.push(
      `Calendar (${b.events.length} events): ${b.events
        .map((e) => `${e.time} ${e.title}`)
        .join("; ")}`,
    );
  }

  if (b.priorityMessages.length > 0) {
    lines.push(
      `High-priority unread: ${b.priorityMessages
        .map((m) => `"${m.subject}" from ${m.from}`)
        .join("; ")}`,
    );
  }
  lines.push(`Unread total: ${b.unreadCount}`);

  if (b.finance) {
    lines.push(
      `Finance (this month): income $${b.finance.incomeMonth}, expenses $${Math.abs(
        b.finance.expenseMonth,
      )}, net cash $${b.finance.netCash}`,
    );
  }

  if (b.pipeline && b.pipeline.length > 0) {
    lines.push(
      `Pipeline: ${b.pipeline
        .map((p) => `${p.count} ${p.stage} ($${p.value})`)
        .join(", ")}`,
    );
  }

  if (b.projects && b.projects.length > 0) {
    const atRisk = b.projects.filter((p) => p.status !== "On track" && p.status !== "Done");
    if (atRisk.length > 0) {
      lines.push(
        `Projects flagged: ${atRisk
          .map((p) => `${p.name} (${p.status}, due ${p.due})`)
          .join("; ")}`,
      );
    }
    lines.push(`Total active projects: ${b.projects.filter((p) => p.status !== "Done").length}`);
  }

  lines.push("");
  lines.push("Write the morning brief.");

  return lines.join("\n");
}
