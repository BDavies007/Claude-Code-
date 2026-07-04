import { createServiceClient } from "@/lib/supabase/service";
import type { Connector, SyncResult } from "./types";
import type { SyncConnector } from "@/lib/types/database";
import { calendarConnector } from "./google/calendar";

/** Live connector implementations. Drive/Gmail land in Phase 2 / 4. */
const CONNECTORS: Partial<Record<SyncConnector, Connector>> = {
  gcal: calendarConnector,
};

export function isConnectorLive(key: SyncConnector): boolean {
  return key in CONNECTORS;
}

/**
 * Run one connector for one user: track the run, load the cursor, execute the
 * sync, persist the next cursor, and record success/error. Shared by the sync
 * API route (n8n / "Sync now") so scheduling and manual runs behave identically.
 */
export async function runConnector(
  key: SyncConnector,
  userId: string,
): Promise<SyncResult> {
  const connector = CONNECTORS[key];
  if (!connector) {
    throw new Error(`Connector "${key}" is not implemented yet.`);
  }

  const svc = createServiceClient();

  const { data: run } = await svc
    .from("sync_runs")
    .insert({ user_id: userId, connector: key, status: "running" })
    .select("id")
    .single();

  await svc.from("sync_state").upsert(
    { user_id: userId, connector: key, status: "running" },
    { onConflict: "user_id,connector" },
  );

  // Load the persisted cursor.
  const { data: state } = await svc
    .from("sync_state")
    .select("cursor")
    .eq("user_id", userId)
    .eq("connector", key)
    .maybeSingle();

  try {
    const result = await connector.sync({
      userId,
      cursor: state?.cursor ?? null,
    });

    await svc.from("sync_state").upsert(
      {
        user_id: userId,
        connector: key,
        cursor: result.cursor,
        status: "idle",
        last_error: null,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,connector" },
    );

    if (run) {
      await svc
        .from("sync_runs")
        .update({
          status: "success",
          items_upserted: result.upserts,
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";

    await svc
      .from("sync_state")
      .update({ status: "error", last_error: message })
      .eq("user_id", userId)
      .eq("connector", key);

    if (run) {
      await svc
        .from("sync_runs")
        .update({
          status: "error",
          error: message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }

    throw err;
  }
}
