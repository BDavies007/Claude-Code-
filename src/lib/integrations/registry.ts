import type { SyncConnector } from "@/lib/types/database";

/**
 * Static metadata for each connector — powers the Settings → Integrations UI
 * and the OAuth scope request. Live `Connector` implementations (calendar.ts,
 * gmail.ts, drive.ts) are wired in during Phase 1+.
 */
export interface ConnectorMeta {
  key: SyncConnector;
  name: string;
  provider: "google";
  description: string;
  /** Where ingested data lands in the app. */
  target: string;
  /** OAuth scopes this connector needs (decided in docs/INTEGRATIONS.md §3). */
  scopes: string[];
  accent: string;
}

export const CONNECTORS: ConnectorMeta[] = [
  {
    key: "gcal",
    name: "Google Calendar",
    provider: "google",
    description:
      "Sync events into Meetings and feed the daily brief's schedule.",
    target: "Meetings",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    accent: "sky",
  },
  {
    key: "gdrive",
    name: "Google Drive",
    provider: "google",
    description:
      "Index documents for context and semantic search (pgvector RAG).",
    target: "Documents",
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    accent: "emerald",
  },
  {
    key: "gmail",
    name: "Gmail",
    provider: "google",
    description:
      "Triage the inbox into proposed tasks and contact enrichment; label threads and draft replies.",
    target: "Tasks & Contacts",
    // gmail.modify — decided: read + label + draft (docs/INTEGRATIONS.md §13).
    scopes: ["https://www.googleapis.com/auth/gmail.modify"],
    accent: "amber",
  },
];

/** All scopes to request in a single Google grant (incremental authorization). */
export function allGoogleScopes(): string[] {
  const base = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/userinfo.email",
  ];
  const connectorScopes = CONNECTORS.flatMap((c) => c.scopes);
  return Array.from(new Set([...base, ...connectorScopes]));
}

export function getConnector(key: SyncConnector): ConnectorMeta | undefined {
  return CONNECTORS.find((c) => c.key === key);
}
