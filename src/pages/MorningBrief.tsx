import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarClock, Mail, Sparkles, RefreshCw } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Button } from "@/components/ui/Button";
import { buildDailyBrief, DailyBrief } from "@/lib/brief";
import { formatTime, greeting } from "@/lib/format";

export function MorningBrief() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const b = await buildDailyBrief();
    setBrief(b);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const now = useMemo(() => new Date(), []);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting(now)}.</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Your daily brief, synthesized across health, calendar, and inbox.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </header>

      <Card className="border-brand/30 bg-gradient-to-br from-bg-elevated to-bg-subtle">
        <CardBody className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-brand-fg">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-fg-muted">
              Today's recommendation
            </div>
            <div className="mt-1 text-base leading-relaxed text-fg">
              {brief?.recommendation ?? "Synthesizing your signals…"}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Recovery"
          value={brief?.recovery ? `${brief.recovery.score}%` : "—"}
          hint={brief?.recovery ? `${brief.recovery.source} · HRV ${brief.recovery.hrv ?? "—"}` : "Not connected"}
          tone={brief?.recovery ? (brief.recovery.score >= 67 ? "success" : brief.recovery.score >= 34 ? "warn" : "danger") : "default"}
          icon={<Activity className="h-4 w-4" />}
        />
        <Stat
          label="Sleep"
          value={brief?.recovery?.sleepHours ? `${brief.recovery.sleepHours}h` : "—"}
          hint="Last night"
        />
        <Stat
          label="Events today"
          value={brief?.events.length ?? 0}
          hint={brief?.events[0] ? `Next: ${brief.events[0].title}` : "Calendar clear"}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <Stat
          label="Unread (priority)"
          value={brief?.messages.filter((m) => m.priority === "high").length ?? 0}
          hint={`${brief?.messages.filter((m) => m.unread).length ?? 0} unread total`}
          icon={<Mail className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today's schedule</CardTitle>
            <span className="text-xs text-fg-muted">{brief?.events.length ?? 0} events</span>
          </CardHeader>
          <CardBody>
            {brief && brief.events.length === 0 ? (
              <p className="text-sm text-fg-muted">Calendar is clear — block a deep work session.</p>
            ) : (
              <ul className="space-y-2.5">
                {brief?.events.map((e) => (
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
            {brief && brief.messages.length === 0 ? (
              <p className="text-sm text-fg-muted">Inbox is empty.</p>
            ) : (
              <ul className="space-y-2.5">
                {brief?.messages.slice(0, 6).map((m) => (
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
