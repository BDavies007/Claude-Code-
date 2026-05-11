import type { HealthAdapter, IntegrationStatus, RecoveryReading } from "./types";

interface WhoopConfig {
  clientId?: string;
  clientSecret?: string;
}

export class WhoopAdapter implements HealthAdapter {
  readonly id = "whoop" as const;
  readonly label = "Whoop";

  readonly configFields = [
    {
      key: "clientId",
      label: "OAuth Client ID",
      type: "text" as const,
      placeholder: "abcd1234-…",
      required: true,
      help: "Whoop developer dashboard → your app → Client ID.",
    },
    {
      key: "clientSecret",
      label: "OAuth Client Secret",
      type: "password" as const,
      help: "Required for Whoop client credentials. Leave blank only if your app is pure PKCE-public.",
    },
  ];

  async readConfig(): Promise<Record<string, string | undefined>> {
    const cfg = await read();
    return { clientId: cfg.clientId, clientSecret: cfg.clientSecret };
  }

  async writeConfig(cfg: Record<string, string | undefined>): Promise<void> {
    const all = (await window.atlas.settings.get<Record<string, unknown>>("integrations")) ?? {};
    const existing = (all.whoop as WhoopConfig | undefined) ?? {};
    const next: WhoopConfig = {
      ...existing,
      clientId: cfg.clientId || existing.clientId,
      clientSecret: cfg.clientSecret || existing.clientSecret,
    };
    await window.atlas.settings.set("integrations", { ...all, whoop: next });
  }

  async status(): Promise<IntegrationStatus> {
    if (!window.atlas?.whoop) return { connected: false };
    const s = await window.atlas.whoop.status();
    return {
      connected: s.connected,
      lastSync: s.expiresAt ? new Date(s.expiresAt).toISOString() : undefined,
    };
  }

  async connect(): Promise<void> {
    const cfg = await read();
    if (!cfg.clientId) {
      throw new Error(
        "Whoop Client ID is not set. Open Settings → Whoop → Configure first.",
      );
    }
    await window.atlas.whoop.connect(cfg.clientId, cfg.clientSecret);
  }

  async disconnect(): Promise<void> {
    await window.atlas.whoop.disconnect();
  }

  async recovery(date?: Date): Promise<RecoveryReading | null> {
    const { connected } = await this.status();
    if (!connected) return mockRecovery(date);
    try {
      const [rec, sleep, cycle] = await Promise.all([
        window.atlas.whoop.recovery(),
        window.atlas.whoop.sleep(),
        window.atlas.whoop.cycle(),
      ]);
      if (!rec) return mockRecovery(date);
      const score = rec.score?.recovery_score;
      const restingHr = rec.score?.resting_heart_rate;
      const hrv = rec.score?.hrv_rmssd_milli ? Math.round(rec.score.hrv_rmssd_milli) : undefined;
      const sleepMs = sleep?.score?.stage_summary?.total_in_bed_time_milli;
      const sleepAwakeMs = sleep?.score?.stage_summary?.total_awake_time_milli ?? 0;
      const sleepHours = sleepMs ? Math.round(((sleepMs - sleepAwakeMs) / 3_600_000) * 10) / 10 : undefined;
      return {
        source: "whoop",
        date: (rec.updated_at ?? new Date().toISOString()).slice(0, 10),
        score: typeof score === "number" ? Math.round(score) : 0,
        restingHr,
        hrv,
        sleepHours,
        strain: cycle?.score?.strain,
      };
    } catch (e) {
      console.error("Whoop recovery fetch failed:", e);
      return mockRecovery(date);
    }
  }
}

async function read(): Promise<WhoopConfig> {
  const all = (await window.atlas.settings.get<{ whoop?: WhoopConfig }>("integrations")) ?? {};
  return all.whoop ?? {};
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
