import { createServiceClient } from "@/lib/supabase/service";
import type { Connector, SyncContext, SyncResult, HealthResult } from "../types";
import { normalizeEvent, type GCalEvent } from "../normalize/calendar";
import { getGoogleAccessToken, googleGet } from "./client";

const CAL_BASE =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const LOOKBACK_DAYS = 30;
const PAGE_SIZE = 250;

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Google Calendar → Meetings.
 *
 * Incremental via `syncToken` when we have one, else a bounded full sync
 * (last 30 days forward). Idempotent: every event is keyed through
 * `external_links`, so re-runs update in place rather than duplicating.
 */
export const calendarConnector: Connector = {
  key: "gcal",

  async healthCheck(userId: string): Promise<HealthResult> {
    try {
      const token = await getGoogleAccessToken(userId);
      const { status } = await googleGet(
        token,
        `${CAL_BASE}?maxResults=1`,
      );
      return status < 400
        ? { ok: true }
        : { ok: false, reason: `Calendar API ${status}` };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "error" };
    }
  },

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const token = await getGoogleAccessToken(ctx.userId);
    const svc = createServiceClient();

    let pageToken: string | undefined;
    let syncToken = ctx.cursor ?? undefined;
    let nextSyncToken: string | null = ctx.cursor ?? null;
    let upserts = 0;
    let usedFullSync = false;

    do {
      const params = new URLSearchParams({
        singleEvents: "true",
        showDeleted: "true",
        maxResults: String(PAGE_SIZE),
      });
      if (pageToken) params.set("pageToken", pageToken);
      if (syncToken) {
        params.set("syncToken", syncToken);
      } else {
        // Full sync path: bounded window, ordered.
        usedFullSync = true;
        const timeMin = new Date(
          Date.now() - LOOKBACK_DAYS * 86_400_000,
        ).toISOString();
        params.set("timeMin", timeMin);
        params.set("orderBy", "startTime");
      }

      const { status, json } = await googleGet(
        token,
        `${CAL_BASE}?${params.toString()}`,
      );

      // 410 Gone → the syncToken expired. Reset and restart a full sync once.
      if (status === 410 && syncToken) {
        syncToken = undefined;
        pageToken = undefined;
        nextSyncToken = null;
        continue;
      }
      if (status >= 400) {
        throw new Error(`Calendar API error ${status}`);
      }

      const items: GCalEvent[] = json?.items ?? [];
      for (const event of items) {
        upserts += await upsertEvent(svc, ctx.userId, event);
      }

      pageToken = json?.nextPageToken;
      if (json?.nextSyncToken) nextSyncToken = json.nextSyncToken;
    } while (pageToken);

    // On a full sync the syncToken only arrives on the final page; keep prior
    // cursor if Google didn't return a fresh one.
    void usedFullSync;
    return { cursor: nextSyncToken, upserts };
  },
};

/** Upsert a single event into `meetings`, keyed by `external_links`. Returns 1 if written. */
async function upsertEvent(
  svc: ServiceClient,
  userId: string,
  event: GCalEvent,
): Promise<number> {
  const { data: link } = await svc
    .from("external_links")
    .select("entity_id")
    .eq("user_id", userId)
    .eq("source", "gcal")
    .eq("external_id", event.id)
    .maybeSingle();

  // Cancelled events: mark an existing meeting cancelled; ignore unknown ones.
  if (event.status === "cancelled") {
    if (link) {
      await svc
        .from("meetings")
        .update({ status: "cancelled" })
        .eq("id", link.entity_id);
      return 1;
    }
    return 0;
  }

  const normalized = normalizeEvent(event);
  if (!normalized) return 0;

  if (link) {
    await svc.from("meetings").update(normalized).eq("id", link.entity_id);
    return 1;
  }

  const { data: inserted, error } = await svc
    .from("meetings")
    .insert({ ...normalized, user_id: userId })
    .select("id")
    .single();
  if (error || !inserted) {
    throw new Error(error?.message ?? "Failed to insert meeting.");
  }

  await svc.from("external_links").insert({
    user_id: userId,
    provider: "google",
    source: "gcal",
    external_id: event.id,
    entity_table: "meetings",
    entity_id: inserted.id,
    raw: event as unknown as Record<string, unknown>,
  });

  return 1;
}
