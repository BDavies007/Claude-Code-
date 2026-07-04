import type { SyncConnector } from "@/lib/types/database";

/**
 * The uniform contract every source connector implements. The sync
 * orchestrator drives this interface and never knows which provider it is
 * talking to. See docs/INTEGRATIONS.md §5.
 */
export interface SyncContext {
  userId: string;
  /** Persisted cursor from `sync_state` (syncToken / historyId / pageToken). */
  cursor: string | null;
  since?: Date;
}

export interface SyncResult {
  /** Next cursor to persist. */
  cursor: string | null;
  /** Rows upserted into domain tables this run. */
  upserts: number;
  /** Human-in-the-loop suggestions created this run (e.g. Gmail triage). */
  suggestions?: number;
}

export interface HealthResult {
  ok: boolean;
  reason?: string;
}

export interface Connector {
  key: SyncConnector;
  /** Pull changes since `ctx.cursor`, normalize, upsert, return next cursor. */
  sync(ctx: SyncContext): Promise<SyncResult>;
  /** Validate the OAuth grant / required scopes for this user. */
  healthCheck(userId: string): Promise<HealthResult>;
}
