import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { whoop, garmin } from "@/integrations";
import type { RecoveryReading } from "@/integrations/types";

export function Health() {
  const [whoopData, setWhoopData] = useState<RecoveryReading | null>(null);
  const [garminData, setGarminData] = useState<RecoveryReading | null>(null);

  useEffect(() => {
    whoop.recovery().then(setWhoopData);
    garmin.recovery().then(setGarminData);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
        <p className="mt-1 text-sm text-fg-muted">Recovery, strain, and sleep across Whoop and Garmin.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProviderCard title="Whoop" reading={whoopData} />
        <ProviderCard title="Garmin" reading={garminData} />
      </div>
    </div>
  );
}

function ProviderCard({ title, reading }: { title: string; reading: RecoveryReading | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="text-xs text-fg-muted">{reading ? "Mock data — not yet connected" : "—"}</span>
      </CardHeader>
      <CardBody className="grid grid-cols-2 gap-3">
        <Stat label="Recovery" value={reading ? `${reading.score}%` : "—"} />
        <Stat label="HRV" value={reading?.hrv ?? "—"} />
        <Stat label="Resting HR" value={reading?.restingHr ?? "—"} />
        <Stat label="Sleep" value={reading?.sleepHours ? `${reading.sleepHours}h` : "—"} />
      </CardBody>
    </Card>
  );
}
