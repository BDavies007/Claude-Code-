import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, CalendarClock, Mail, Sparkles, RefreshCw, Brain } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Button } from "@/components/ui/Button";
import {
  gatherSignals,
  buildBriefInput,
  ruleBasedRecommendation,
  type DailySignals,
} from "@/lib/brief";
import type { BriefInput, BriefDonePayload } from "@/types/atlas";
import { formatTime, greeting } from "@/lib/format";

interface State {
  signals: DailySignals | null;
  input: BriefInput | null;
  recommendation: string;
  thinking: string;
  source: "loading" | "ai" | "rule" | "error";
  error?: string;
}

export function MorningBrief() {
  const [state, setState] = useState<State>({
    signals: null,
    input: null,
    recommendation: "",
    thinking: "",
    source: "loading",
  });
  const streamIdRef = useRef<string | null>(null);

  const load = async () => {
    setState({
      signals: null,
      input: null,
      recommendation: "",
      thinking: "",
      source: "loading",
    });

    const signals = await gatherSignals();
    const input = await buildBriefInput(signals);

    // Update visible stats immediately while AI streams
    setState((s) => ({ ...s, signals, input }));

    const ai = await window.atlas.ai.status();
    if (!ai.configured) {
      setState((s) => ({
        ...s,
        recommendation: ruleBasedRecommendation(input),
        source: "rule",
      }));
      return;
    }

    const streamId = crypto.randomUUID();
    streamIdRef.current = streamId;
    setState((s) => ({ ...s, recommendation: "", thinking: "", source: "ai" }));

    // Subscribe before kicking off the request.
    const off = window.atlas.ai.onBriefEvent((kind, sid, payload) => {
      if (sid !== streamId) return;
      if (kind === "text") {
        setState((s) => ({ ...s, recommendation: s.recommendation + String(payload) }));
      } else if (kind === "thinking") {
        setState((s) => ({ ...s, thinking: s.thinking + String(payload) }));
      } else if (kind === "done") {
        const final = payload as BriefDonePayload;
        setState((s) => ({ ...s, recommendation: final.text || s.recommendation }));
        off();
      } else if (kind === "error") {
        setState((s) => ({
          ...s,
          recommendation: ruleBasedRecommendation(input),
          source: "error",
          error: String(payload),
        }));
        off();
      }
    });

    await window.atlas.ai.generateBrief(streamId, input);
  };

  useEffect(() => {
    load();
    return () => {
      if (streamIdRef.current) {
        window.atlas.ai.cancelBrief(streamIdRef.current);
      }
    };
  }, []);

  const now = useMemo(() => new Date(), []);
  const { signals, recommendation, thinking, source, error } = state;
  const loading = source === "loading" || (source === "ai" && recommendation.length === 0);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting(now)}.</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {source === "ai" || source === "loading"
              ? "AI-synthesized brief across health, calendar, inbox, finance, and pipeline."
              : source === "rule"
                ? "Rule-based brief — add an Anthropic API key in Settings for AI-generated reasoning."
                : "AI brief failed, falling back to rule-based reasoning."}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </header>

      <Card className="border-brand/30 bg-gradient-to-br from-bg-elevated to-bg-subtle">
        <CardBody className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-brand-fg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
                Today's brief
                {source === "ai" && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] text-brand">
                    Opus 4.7
                  </span>
                )}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-fg">
                {recommendation || (loading ? "Synthesizing your signals…" : "—")}
                {source === "ai" && loading && (
                  <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-fg" />
                )}
              </div>
              {error && <div className="mt-2 text-xs text-danger">{error}</div>}
            </div>
          </div>

          {thinking && (
            <details className="rounded-md border border-border bg-bg/50 px-3 py-2 text-xs text-fg-muted">
              <summary className="flex cursor-pointer items-center gap-2 select-none">
                <Brain className="h-3.5 w-3.5" />
                <span>Reasoning</span>
              </summary>
              <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                {thinking}
              </pre>
            </details>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Recovery"
          value={signals?.recovery ? `${signals.recovery.score}%` : "—"}
          hint={
            signals?.recovery
              ? `${signals.recovery.source} · HRV ${signals.recovery.hrv ?? "—"}`
              : "Not connected"
          }
          tone={
            signals?.recovery
              ? signals.recovery.score >= 67
                ? "success"
                : signals.recovery.score >= 34
                  ? "warn"
                  : "danger"
              : "default"
          }
          icon={<Activity className="h-4 w-4" />}
        />
        <Stat
          label="Sleep"
          value={signals?.recovery?.sleepHours ? `${signals.recovery.sleepHours}h` : "—"}
          hint="Last night"
        />
        <Stat
          label="Events today"
          value={signals?.events.length ?? 0}
          hint={signals?.events[0] ? `Next: ${signals.events[0].title}` : "Calendar clear"}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <Stat
          label="Unread (priority)"
          value={signals?.messages.filter((m) => m.priority === "high").length ?? 0}
          hint={`${signals?.messages.filter((m) => m.unread).length ?? 0} unread total`}
          icon={<Mail className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today's schedule</CardTitle>
            <span className="text-xs text-fg-muted">{signals?.events.length ?? 0} events</span>
          </CardHeader>
          <CardBody>
            {signals && signals.events.length === 0 ? (
              <p className="text-sm text-fg-muted">Calendar is clear — block a deep work session.</p>
            ) : (
              <ul className="space-y-2.5">
                {signals?.events.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-md border border-border bg-bg p-3">
                    <div className="grid w-16 shrink-0 text-center">
                      <span className="text-sm font-semibold">{formatTime(new Date(e.start))}</span>
                      <span className="text-[10px] uppercase tracking-wide text-fg-muted">
                        {formatTime(new Date(e.end))}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{e.title}</div>
                      <div className="text-xs text-fg-muted">via {e.source}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority inbox</CardTitle>
            <span className="text-xs text-fg-muted">Outlook + Gmail</span>
          </CardHeader>
          <CardBody>
            {signals && signals.messages.length === 0 ? (
              <p className="text-sm text-fg-muted">Inbox is empty.</p>
            ) : (
              <ul className="space-y-2.5">
                {signals?.messages.slice(0, 6).map((m) => (
                  <li key={m.id} className="rounded-md border border-border bg-bg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{m.from}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-fg-muted">
                        {m.source}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm">{m.subject}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-fg-muted">{m.snippet}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
