import { gmail, outlook, whoop, garmin } from "@/integrations";
import type { CalendarEvent, InboxMessage, RecoveryReading } from "@/integrations/types";

export interface DailyBrief {
  recovery: RecoveryReading | null;
  events: CalendarEvent[];
  messages: InboxMessage[];
  recommendation: string;
}

export async function buildDailyBrief(): Promise<DailyBrief> {
  const [whoopR, garminR, outlookEvents, gmailEvents, outlookMail, gmailMail] = await Promise.all([
    whoop.recovery().catch(() => null),
    garmin.recovery().catch(() => null),
    outlook.upcomingEvents(1).catch(() => []),
    gmail.upcomingEvents(1).catch(() => []),
    outlook.recentMessages(10).catch(() => []),
    gmail.recentMessages(10).catch(() => []),
  ]);

  const recovery = pickRecovery(whoopR, garminR);
  const events = [...outlookEvents, ...gmailEvents].sort((a, b) => a.start.localeCompare(b.start));
  const messages = [...outlookMail, ...gmailMail].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return {
    recovery,
    events,
    messages,
    recommendation: recommend(recovery, events, messages),
  };
}

function pickRecovery(a: RecoveryReading | null, b: RecoveryReading | null): RecoveryReading | null {
  if (a && b) return a.score >= b.score ? a : b;
  return a ?? b;
}

function recommend(
  recovery: RecoveryReading | null,
  events: CalendarEvent[],
  messages: InboxMessage[],
): string {
  const highPriority = messages.filter((m) => m.priority === "high");
  const lowRecovery = recovery && recovery.score < 50;
  const heavyDay = events.length >= 4;

  if (lowRecovery && heavyDay) {
    return "Recovery is low and your calendar is heavy. Reschedule one block, swap workout for mobility, prioritize sleep tonight.";
  }
  if (lowRecovery) {
    return "Recovery is below baseline — keep training light, hydrate, eat early, and aim for an 8h sleep window.";
  }
  if (highPriority.length > 0) {
    return `Open with ${highPriority[0].from}: "${highPriority[0].subject}". Reply before the first meeting.`;
  }
  if (heavyDay) {
    return "Calendar is busy. Protect a 90-min deep work block and pre-write meeting agendas tonight.";
  }
  return "Good recovery and a manageable day — pick one needle-mover and block 90 minutes for it before noon.";
}
