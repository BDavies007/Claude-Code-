import type { CalendarAdapter, CalendarEvent, InboxMessage, IntegrationStatus, MailAdapter } from "./types";

/**
 * Google adapter for Gmail + Google Calendar.
 * Real wiring:
 *  - Create OAuth client (Desktop type) in Google Cloud Console
 *  - Loopback redirect (http://127.0.0.1:<port>/oauth2callback)
 *  - Scopes: gmail.readonly, calendar.readonly
 *  - APIs: gmail.users.messages.list/get, calendar.events.list
 */
export class GmailAdapter implements MailAdapter, CalendarAdapter {
  readonly id = "gmail" as const;
  readonly label = "Gmail & Google Calendar";

  async status(): Promise<IntegrationStatus> {
    const tokens = await readTokens();
    return { connected: !!tokens?.accessToken };
  }

  async connect(): Promise<void> {
    throw new Error("Gmail OAuth not yet wired. Configure Google Cloud OAuth client + loopback redirect.");
  }

  async disconnect(): Promise<void> {
    await window.atlas.settings.set("integrations.gmail", {});
  }

  async recentMessages(limit = 10): Promise<InboxMessage[]> {
    const { connected } = await this.status();
    if (!connected) return mockMessages(limit);
    return mockMessages(limit);
  }

  async upcomingEvents(rangeDays = 7): Promise<CalendarEvent[]> {
    const { connected } = await this.status();
    if (!connected) return mockEvents(rangeDays);
    return mockEvents(rangeDays);
  }
}

async function readTokens() {
  const all = (await window.atlas.settings.all()) as { integrations?: { gmail?: { accessToken?: string } } };
  return all.integrations?.gmail;
}

function mockMessages(limit: number): InboxMessage[] {
  return [
    {
      source: "gmail",
      id: "g1",
      from: "Stripe",
      subject: "Payout of $4,820.00 sent",
      snippet: "Your payout is on its way to your bank…",
      receivedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      unread: true,
    },
    {
      source: "gmail",
      id: "g2",
      from: "Lead via LinkedIn",
      subject: "Interested in a discovery call",
      snippet: "Hi — saw your post on lead-gen workflows. We'd love to chat…",
      receivedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      unread: true,
      priority: "high",
    },
  ].slice(0, limit);
}

function mockEvents(_rangeDays: number): CalendarEvent[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tEnd = new Date(tomorrow);
  tEnd.setHours(11, 0, 0, 0);
  return [
    {
      source: "gmail",
      id: "g-cal-1",
      title: "Discovery call — new lead",
      start: tomorrow.toISOString(),
      end: tEnd.toISOString(),
    },
  ];
}
