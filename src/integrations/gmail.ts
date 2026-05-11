import type {
  CalendarAdapter,
  CalendarEvent,
  InboxMessage,
  IntegrationStatus,
  MailAdapter,
} from "./types";
import type { GmailMessage, GoogleCalendarEvent } from "@/types/atlas";

const HIGH_PRIORITY_LABEL = "IMPORTANT";

interface GmailConfig {
  clientId?: string;
  clientSecret?: string;
}

/**
 * Gmail + Google Calendar adapter.
 *
 * Real OAuth runs in the Electron main process; the renderer only sees
 * normalized data. Configure your OAuth client in Settings or via env vars,
 * then click Connect to launch the loopback PKCE flow.
 *
 * Falls back to mock data when not connected so the UI is always usable.
 */
export class GmailAdapter implements MailAdapter, CalendarAdapter {
  readonly id = "gmail" as const;
  readonly label = "Gmail & Google Calendar";

  readonly configFields = [
    {
      key: "clientId",
      label: "OAuth Client ID",
      type: "text" as const,
      placeholder: "xxxx.apps.googleusercontent.com",
      required: true,
      help: "Google Cloud Console → OAuth 2.0 Client (Desktop app)",
    },
    {
      key: "clientSecret",
      label: "OAuth Client Secret",
      type: "password" as const,
      placeholder: "GOCSPX-…",
      help: "Required for Google Desktop OAuth clients.",
    },
  ];

  async readConfig(): Promise<Record<string, string | undefined>> {
    const cfg = await readConfig();
    return { clientId: cfg.clientId, clientSecret: cfg.clientSecret };
  }

  async writeConfig(cfg: Record<string, string | undefined>): Promise<void> {
    const integrations =
      (await window.atlas.settings.get<Record<string, unknown>>("integrations")) ?? {};
    const existing = (integrations.gmail as GmailConfig | undefined) ?? {};
    const next: GmailConfig = {
      ...existing,
      clientId: cfg.clientId || existing.clientId,
      clientSecret: cfg.clientSecret || existing.clientSecret,
    };
    await window.atlas.settings.set("integrations", { ...integrations, gmail: next });
  }

  async status(): Promise<IntegrationStatus> {
    if (!window.atlas?.google) return { connected: false };
    const s = await window.atlas.google.status();
    return {
      connected: s.connected,
      lastSync: s.expiresAt ? new Date(s.expiresAt).toISOString() : undefined,
    };
  }

  async connect(): Promise<void> {
    const cfg = await readConfig();
    if (!cfg.clientId) {
      throw new Error(
        "Google Client ID is not set. Open Settings → Gmail → Configure and paste your OAuth client credentials first.",
      );
    }
    await window.atlas.google.connect(cfg.clientId, cfg.clientSecret);
  }

  async disconnect(): Promise<void> {
    await window.atlas.google.disconnect();
  }

  async recentMessages(limit = 10): Promise<InboxMessage[]> {
    const { connected } = await this.status();
    if (!connected) return mockMessages(limit);
    try {
      const raw = await window.atlas.google.listMessages(limit);
      return raw.map(normalizeMessage);
    } catch (e) {
      console.error("Gmail listMessages failed:", e);
      return mockMessages(limit);
    }
  }

  async upcomingEvents(rangeDays = 7): Promise<CalendarEvent[]> {
    const { connected } = await this.status();
    if (!connected) return mockEvents(rangeDays);
    try {
      const raw = await window.atlas.google.listEvents(rangeDays);
      return raw.map(normalizeEvent).filter((e): e is CalendarEvent => e !== null);
    } catch (e) {
      console.error("Calendar listEvents failed:", e);
      return mockEvents(rangeDays);
    }
  }
}

async function readConfig(): Promise<GmailConfig> {
  const integrations = (await window.atlas.settings.get<{ gmail?: GmailConfig }>("integrations")) ?? {};
  return integrations.gmail ?? {};
}

function normalizeMessage(raw: GmailMessage): InboxMessage {
  const headers = Object.fromEntries(
    (raw.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]),
  );
  const from = headers["from"] ?? "(unknown)";
  const subject = headers["subject"] ?? "(no subject)";
  const date = headers["date"]
    ? new Date(headers["date"]).toISOString()
    : raw.internalDate
      ? new Date(Number(raw.internalDate)).toISOString()
      : new Date().toISOString();
  const labels = raw.labelIds ?? [];
  return {
    source: "gmail",
    id: raw.id,
    from: stripEmailAngles(from),
    subject,
    snippet: raw.snippet ?? "",
    receivedAt: date,
    unread: labels.includes("UNREAD"),
    priority: labels.includes(HIGH_PRIORITY_LABEL) ? "high" : undefined,
  };
}

function normalizeEvent(raw: GoogleCalendarEvent): CalendarEvent | null {
  const start = raw.start?.dateTime ?? raw.start?.date;
  const end = raw.end?.dateTime ?? raw.end?.date;
  if (!start || !end) return null;
  return {
    source: "gmail",
    id: raw.id,
    title: raw.summary ?? "(no title)",
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    location: raw.location,
    attendees: raw.attendees?.map((a) => a.displayName ?? a.email),
  };
}

function stripEmailAngles(s: string): string {
  // "Name <email@x.com>" → "Name"; "email@x.com" → "email@x.com"
  const m = s.match(/^\s*"?([^"<]+?)"?\s*<.+>\s*$/);
  return m ? m[1] : s;
}

function mockMessages(limit: number): InboxMessage[] {
  const msgs: InboxMessage[] = [
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
  ];
  return msgs.slice(0, limit);
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
