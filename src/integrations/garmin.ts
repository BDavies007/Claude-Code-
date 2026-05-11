import type { HealthAdapter, IntegrationStatus, RecoveryReading } from "./types";

/**
 * Garmin Connect adapter.
 * Two viable paths:
 *  1) Official Garmin Health API (requires partnership / paid tier)
 *  2) Unofficial Garmin Connect web auth (python-garminconnect style) — fragile, but works for personal use
 *
 * Stubbed for v1.
 */
export class GarminAdapter implements HealthAdapter {
  readonly id = "garmin" as const;
  readonly label = "Garmin Connect";

  async status(): Promise<IntegrationStatus> {
    const tokens = await readTokens();
    return { connected: !!tokens?.accessToken };
  }

  async connect(): Promise<void> {
    throw new Error("Garmin auth not yet wired. Choose between official Health API or Connect web login.");
  }

  async disconnect(): Promise<void> {
    await window.atlas.settings.set("integrations.garmin", {});
  }

  async recovery(date?: Date): Promise<RecoveryReading | null> {
    const { connected } = await this.status();
    if (!connected) return mockRecovery(date);
    return mockRecovery(date);
  }
}

async function readTokens() {
  const all = (await window.atlas.settings.all()) as { integrations?: { garmin?: { accessToken?: string } } };
  return all.integrations?.garmin;
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
