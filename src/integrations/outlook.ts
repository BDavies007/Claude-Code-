import type {
  CalendarAdapter,
  CalendarEvent,
  InboxMessage,
  IntegrationStatus,
  MailAdapter,
} from "./types";
import type { GraphMessage, GraphEvent } from "@/types/atlas";

interface OutlookConfig {
  clientId?: string;
  clientSecret?: string;
  tenant?: string;
}

export class OutlookAdapter implements MailAdapter, CalendarAdapter {
  readonly id = "outlook" as const;
  readonly label = "Outlook (Microsoft 365)";

  readonly configFields = [
    {
      key: "clientId",
      label: "Application (Client) ID",
      type: "text" as const,
      placeholder: "00000000-0000-0000-0000-000000000000",
      required: true,
      help: "Azure App Registration → Overview → Application (client) ID.",
    },
    {
      key: "clientSecret",
      label: "Client Secret (optional)",
      type: "password" as const,
      help:
        "Leave blank for a public client with PKCE. Only fill in if you created a confidential client.",
    },
    {
      key: "tenant",
      label: "Tenant",
      type: "text" as const,
      placeholder: "common",
      help: "`common` for personal + work accounts, or your tenant GUID.",
    },
  ];

  async readConfig(): Promise<Record<string, string | undefined>> {
    const cfg = await read();
    return { clientId: cfg.clientId, clientSecret: cfg.clientSecret, tenant: cfg.tenant };
  }

  async writeConfig(cfg: Record<string, string | undefined>): Promise<void> {
    const all = (await window.atlas.settings.get<Record<string, unknown>>("integrations")) ?? {};
    const existing = (all.outlook as OutlookConfig | undefined) ?? {};
    const next: OutlookConfig = {
      ...existing,
      clientId: cfg.clientId || existing.clientId,
      clientSecret: cfg.clientSecret || existing.clientSecret,
      tenant: cfg.tenant || existing.tenant,
    };
    await window.atlas.settings.set("integrations", { ...all, outlook: next });
  }

  async status(): Promise<IntegrationStatus> {
    if (!window.atlas?.microsoft) return { connected: false };
    const s = await window.atlas.microsoft.status();
    return {
      connected: s.connected,
      lastSync: s.expiresAt ? new Date(s.expiresAt).toISOString() : undefined,
    };
  }

  async connect(): Promise<void> {
    const cfg = await read();
    if (!cfg.clientId) {
      throw new Error(
        "Application (Client) ID is not set. Open Settings → Outlook → Configure and paste your Azure App Registration client ID first.",
      );
    }
    await window.atlas.microsoft.connect(cfg.clientId, cfg.clientSecret, cfg.tenant);
  }

  async disconnect(): Promise<void> {
    await window.atlas.microsoft.disconnect();
  }

  async recentMessages(limit = 10): Promise<InboxMessage[]> {
    const { connected } = await this.status();
    if (!connected) return mockMessages(limit);
    try {
      const raw = await window.atlas.microsoft.listMessages(limit);
      return raw.map(normalizeMessage);
    } catch (e) {
      console.error("Outlook listMessages failed:", e);
      return mockMessages(limit);
    }
  }

  async upcomingEvents(rangeDays = 7): Promise<CalendarEvent[]> {
    const { connected } = await this.status();
    if (!connected) return mockEvents(rangeDays);
    try {
      const raw = await window.atlas.microsoft.listEvents(rangeDays);
      return raw.map(normalizeEvent).filter((e): e is CalendarEvent => e !== null);
    } catch (e) {
      console.error("Outlook listEvents failed:", e);
      return mockEvents(rangeDays);
    }
  }
}

async function read(): Promise<OutlookConfig> {
  const all = (await window.atlas.settings.get<{ outlook?: OutlookConfig }>("integrations")) ?? {};
  return all.outlook ?? {};
}

function normalizeMessage(raw: GraphMessage): InboxMessage {
  const fromName = raw.from?.emailAddress?.name ?? raw.from?.emailAddress?.address ?? "(unknown)";
  return {
    source: "outlook",
    id: raw.id,
    from: fromName,
    subject: raw.subject ?? "(no subject)",
    snippet: raw.bodyPreview ?? "",
    receivedAt: raw.receivedDateTime ?? new Date().toISOString(),
    unread: raw.isRead === false,
    priority: raw.importance === "high" ? "high" : undefined,
  };
}

function normalizeEvent(raw: GraphEvent): CalendarEvent | null {
  if (!raw.start?.dateTime || !raw.end?.dateTime) return null;
  return {
    source: "outlook",
    id: raw.id,
    title: raw.subject ?? "(no title)",
    start: new Date(raw.start.dateTime + "Z").toISOString(),
    end: new Date(raw.end.dateTime + "Z").toISOString(),
    location: raw.location?.displayName,
    attendees: raw.attendees?.map(
      (a) => a.emailAddress?.name ?? a.emailAddress?.address ?? "",
    ),
  };
}

function mockMessages(limit: number): InboxMessage[] {
  const msgs: InboxMessage[] = [
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
  return msgs.slice(0, limit);
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
