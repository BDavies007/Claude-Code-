import type { HealthAdapter, IntegrationStatus, RecoveryReading } from "./types";

/**
 * Whoop adapter. Real implementation requires:
 *  - OAuth 2.0 PKCE flow via developer.whoop.com
 *  - Token storage in electron-store (settings.integrations.whoop)
 *  - REST calls to https://api.prod.whoop.com/developer/v1/...
 *
 * For now this returns mock data so the UI is fully functional offline.
 */
export class WhoopAdapter implements HealthAdapter {
  readonly id = "whoop" as const;
  readonly label = "Whoop";

  async status(): Promise<IntegrationStatus> {
    const tokens = await readTokens();
    return { connected: !!tokens?.accessToken, lastSync: tokens?.accessToken ? new Date().toISOString() : undefined };
  }

  async connect(): Promise<void> {
    throw new Error("Whoop OAuth not yet wired. Add WHOOP_CLIENT_ID + PKCE flow in electron/main.ts.");
  }

  async disconnect(): Promise<void> {
    await window.atlas.settings.set("integrations.whoop", {});
  }

  async recovery(date?: Date): Promise<RecoveryReading | null> {
    const { connected } = await this.status();
    if (!connected) return mockRecovery(date);
    // TODO: GET /v1/recovery + /v1/cycle
    return mockRecovery(date);
  }
}

async function readTokens() {
  const all = (await window.atlas.settings.all()) as { integrations?: { whoop?: { accessToken?: string } } };
  return all.integrations?.whoop;
}

function mockRecovery(date = new Date()): RecoveryReading {
  return {
    source: "whoop",
    date: date.toISOString().slice(0, 10),
    score: 72,
    restingHr: 54,
    hrv: 62,
    sleepHours: 7.4,
    strain: 11.2,
  };
}
