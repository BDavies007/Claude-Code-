import { gmail, outlook, whoop, garmin } from "@/integrations";
import type { CalendarEvent, InboxMessage, RecoveryReading } from "@/integrations/types";
import type { BriefInput } from "@/types/atlas";
import { formatTime } from "./format";

export interface DailySignals {
  recovery: RecoveryReading | null;
  events: CalendarEvent[];
  messages: InboxMessage[];
}

export async function gatherSignals(): Promise<DailySignals> {
  const [whoopR, garminR, outlookEvents, gmailEvents, outlookMail, gmailMail] = await Promise.all([
    whoop.recovery().catch(() => null),
    garmin.recovery().catch(() => null),
    outlook.upcomingEvents(1).catch(() => []),
    gmail.upcomingEvents(1).catch(() => []),
    outlook.recentMessages(10).catch(() => []),
    gmail.recentMessages(10).catch(() => []),
  ]);

  return {
    recovery: pickRecovery(whoopR, garminR),
    events: [...outlookEvents, ...gmailEvents].sort((a, b) => a.start.localeCompare(b.start)),
    messages: [...outlookMail, ...gmailMail].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
  };
}

export async function buildBriefInput(signals: DailySignals): Promise<BriefInput> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const [transactions, clients, projects] = await Promise.all([
    window.atlas.db.finance.list().catch(() => []),
    window.atlas.db.crm.list().catch(() => []),
    window.atlas.db.projects.list().catch(() => []),
  ]);

  const txMonth = transactions.filter((t) => t.date >= monthStart);
  const income = txMonth.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = txMonth.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const netCash = transactions.reduce((s, t) => s + t.amount, 0);

  const pipelineMap = new Map<string, { count: number; value: number }>();
  for (const c of clients) {
    const cur = pipelineMap.get(c.stage) ?? { count: 0, value: 0 };
    pipelineMap.set(c.stage, { count: cur.count + 1, value: cur.value + c.value });
  }

  return {
    date: today.toISOString().slice(0, 10),
    recovery: signals.recovery
      ? {
          source: signals.recovery.source,
          score: signals.recovery.score,
          hrv: signals.recovery.hrv,
          sleepHours: signals.recovery.sleepHours,
          restingHr: signals.recovery.restingHr,
          strain: signals.recovery.strain,
        }
      : null,
    events: signals.events.map((e) => ({
      time: formatTime(new Date(e.start)),
      title: e.title,
      source: e.source,
    })),
    priorityMessages: signals.messages
      .filter((m) => m.priority === "high")
      .map((m) => ({ from: m.from, subject: m.subject, source: m.source })),
    unreadCount: signals.messages.filter((m) => m.unread).length,
    finance: { incomeMonth: income, expenseMonth: expense, netCash },
    pipeline: Array.from(pipelineMap.entries()).map(([stage, v]) => ({
      stage,
      count: v.count,
      value: v.value,
    })),
    projects: projects.map((p) => ({ name: p.name, status: p.status, due: p.due })),
  };
}

function pickRecovery(a: RecoveryReading | null, b: RecoveryReading | null): RecoveryReading | null {
  if (a && b) return a.score >= b.score ? a : b;
  return a ?? b;
}

export function ruleBasedRecommendation(input: BriefInput): string {
  const highPriority = input.priorityMessages;
  const lowRecovery = input.recovery && input.recovery.score < 50;
  const heavyDay = input.events.length >= 4;
  const atRiskProjects = (input.projects ?? []).filter(
    (p) => p.status === "At risk" || p.status === "Blocked",
  );

  if (lowRecovery && heavyDay) {
    return "Recovery is low and the calendar is heavy. Reschedule one block, swap your workout for mobility, and prioritize sleep tonight.";
  }
  if (lowRecovery) {
    return "Recovery is below baseline. Train light, hydrate, eat early, and protect an 8-hour sleep window tonight.";
  }
  if (highPriority.length > 0) {
    return `Open with ${highPriority[0].from}: "${highPriority[0].subject}". Reply before the first meeting.`;
  }
  if (atRiskProjects.length > 0) {
    return `${atRiskProjects[0].name} is ${atRiskProjects[0].status.toLowerCase()} and due ${atRiskProjects[0].due}. Take one concrete step on it this morning.`;
  }
  if (heavyDay) {
    return "Calendar is busy. Protect a 90-minute deep-work block and pre-write meeting agendas tonight.";
  }
  return "Good recovery and a manageable day. Pick one needle-mover and block 90 minutes for it before noon.";
}
