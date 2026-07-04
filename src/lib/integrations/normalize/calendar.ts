import type { Meeting, MeetingStatus } from "@/lib/types/database";

/**
 * Minimal shape of a Google Calendar event (the fields we consume).
 * Pure normalizer — no network calls — so it is trivially unit-testable.
 */
export interface GCalEvent {
  id: string;
  status?: string; // "confirmed" | "tentative" | "cancelled"
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; displayName?: string }>;
}

/** The subset of a `meetings` row an ingest produces (user_id added by caller). */
export type MeetingUpsert = Pick<
  Meeting,
  "title" | "status" | "location" | "starts_at" | "ends_at" | "attendees" | "agenda"
>;

function eventTime(t?: { dateTime?: string; date?: string }): string | null {
  if (!t) return null;
  if (t.dateTime) return new Date(t.dateTime).toISOString();
  if (t.date) return new Date(t.date + "T00:00:00").toISOString();
  return null;
}

function mapStatus(status?: string): MeetingStatus {
  if (status === "cancelled") return "cancelled";
  return "scheduled";
}

/**
 * Map a Google Calendar event to a `meetings` upsert payload.
 * Returns null for events we can't place on a timeline (no start).
 */
export function normalizeEvent(event: GCalEvent): MeetingUpsert | null {
  const starts_at = eventTime(event.start);
  if (!starts_at) return null;

  const location =
    event.location ?? (event.hangoutLink ? "Video call" : null);

  const attendees = (event.attendees ?? [])
    .map((a) => a.displayName || a.email || "")
    .filter(Boolean);

  return {
    title: event.summary?.trim() || "(untitled event)",
    status: mapStatus(event.status),
    location,
    starts_at,
    ends_at: eventTime(event.end),
    attendees,
    agenda: event.description?.trim() || null,
  };
}
