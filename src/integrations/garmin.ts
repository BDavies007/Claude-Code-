import type { HealthAdapter, IntegrationStatus, RecoveryReading } from "./types";

/**
 * Garmin Connect adapter — manual-entry mode.
 *
 * The official Garmin Health API requires a paid partner agreement. The
 * unofficial Connect web-login flow (used by `python-garminconnect` /
 * `garth`) is fragile and arguably violates the Garmin TOS. Rather than
 * ship a brittle scraper, this adapter is a manual ingestion surface:
 * paste your morning Body Battery / HRV / resting HR / sleep into the
 * Health page, and Atlas Hub treats it like any other recovery source.
 *
 * To swap in the real API later, only the methods below need to change;
 * the Morning Brief and Health page already consume `recovery()`.
 */
export class GarminAdapter implements HealthAdapter {
  readonly id = "garmin" as const;
  readonly label = "Garmin (manual entry)";

  // Empty configFields opens the "Configure" panel which only shows the
  // explanatory setup text for Garmin.
  readonly configFields = [] as never[];

  async readConfig(): Promise<Record<string, string | undefined>> {
    return {};
  }

  async writeConfig(_cfg: Record<string, string | undefined>): Promise<void> {
    // no-op
  }

  async status(): Promise<IntegrationStatus> {
    const entries = await window.atlas.garmin.listEntries();
    return {
      connected: entries.length > 0,
      lastSync: entries[0]?.date,
    };
  }

  async connect(): Promise<void> {
    throw new Error(
      "Garmin uses manual entry — open the Health page and log today's metrics. Official API integration requires a Garmin Health partner agreement.",
    );
  }

  async disconnect(): Promise<void> {
    const entries = await window.atlas.garmin.listEntries();
    for (const e of entries) {
      await window.atlas.garmin.deleteEntry(e.date);
    }
  }

  async recovery(date?: Date): Promise<RecoveryReading | null> {
    const entries = await window.atlas.garmin.listEntries();
    if (entries.length === 0) return mockRecovery(date);
    const targetDate = date?.toISOString().slice(0, 10);
    const entry = targetDate
      ? entries.find((e) => e.date === targetDate) ?? entries[0]
      : entries[0];
    return {
      source: "garmin",
      date: entry.date,
      score: entry.score ?? entry.bodyBattery ?? 0,
      restingHr: entry.restingHr,
      hrv: entry.hrv,
      sleepHours: entry.sleepHours,
    };
  }
}

function mockRecovery(date = new Date()): RecoveryReading {
  return {
    source: "garmin",
    date: date.toISOString().slice(0, 10),
    score: 81,
    restingHr: 52,
    hrv: 71,
    sleepHours: 7.8,
  };
}
