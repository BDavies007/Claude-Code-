import type { CalendarAdapter, CalendarEvent, InboxMessage, IntegrationStatus, MailAdapter } from "./types";

/**
 * Microsoft Graph adapter for Outlook mail + calendar.
 * Real wiring:
 *  - Register an Azure AD app, redirect URI e.g. http://localhost:51820/auth/callback
 *  - OAuth 2.0 authorization-code-with-PKCE in electron/main.ts using BrowserWindow
 *  - Scopes: offline_access, Mail.Read, Calendars.Read, User.Read
 *  - Graph endpoints: /me/messages, /me/calendarView
 */
export class OutlookAdapter implements MailAdapter, CalendarAdapter {
  readonly id = "outlook" as const;
  readonly label = "Outlook";

  async status(): Promise<IntegrationStatus> {
    const tokens = await readTokens();
    return { connected: !!tokens?.accessToken };
  }

  async connect(): Promise<void> {
    throw new Error("Outlook OAuth not yet wired. Configure Azure AD app + redirect handler in main process.");
  }

  async disconnect(): Promise<void> {
    await window.atlas.settings.set("integrations.outlook", {});
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
  const all = (await window.atlas.settings.all()) as { integrations?: { outlook?: { accessToken?: string } } };
  return all.integrations?.outlook;
}

function mockMessages(limit: number): InboxMessage[] {
  const base: InboxMessage[] = [
    {
      source: "outlook",
      id: "m1",
      from: "Sarah @ AcmeCorp",
      subject: "Re: Q3 partnership terms",
      snippet: "Thanks for the deck. Two questions on the revenue share…",
      receivedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      unread: true,
      priority: "high",
    },
    {
      source: "outlook",
      id: "m2",
      from: "Notion",
      subject: "Your weekly digest",
      snippet: "12 pages updated across 3 workspaces…",
      receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      unread: true,
    },
  ];
  return base.slice(0, limit);
}

function mockEvents(_rangeDays: number): CalendarEvent[] {
  const today = new Date();
  const at = (h: number, m = 0) => {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  return [
    { source: "outlook", id: "e1", title: "Standup", start: at(9, 0), end: at(9, 15) },
    { source: "outlook", id: "e2", title: "Client review — Northwind", start: at(11, 0), end: at(12, 0) },
    { source: "outlook", id: "e3", title: "Deep work block", start: at(14, 0), end: at(16, 0) },
  ];
}
