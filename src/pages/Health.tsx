import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Button } from "@/components/ui/Button";
import { whoop } from "@/integrations";
import type { RecoveryReading } from "@/integrations/types";
import type { ManualGarminEntry } from "@/types/atlas";

export function Health() {
  const [whoopData, setWhoopData] = useState<RecoveryReading | null>(null);
  const [garminEntries, setGarminEntries] = useState<ManualGarminEntry[]>([]);

  const reloadWhoop = () => whoop.recovery().then(setWhoopData);
  const reloadGarmin = () => window.atlas.garmin.listEntries().then(setGarminEntries);

  useEffect(() => {
    reloadWhoop();
    reloadGarmin();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Recovery, strain, and sleep — Whoop live from the API, Garmin via manual entry.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Whoop</CardTitle>
            <span className="text-xs text-fg-muted">
              {whoopData ? `Latest: ${whoopData.date}` : "—"}
            </span>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-3">
            <Stat label="Recovery" value={whoopData ? `${whoopData.score}%` : "—"} />
            <Stat label="HRV" value={whoopData?.hrv ?? "—"} />
            <Stat label="Resting HR" value={whoopData?.restingHr ?? "—"} />
            <Stat label="Sleep" value={whoopData?.sleepHours ? `${whoopData.sleepHours}h` : "—"} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Garmin — manual entry</CardTitle>
            <span className="text-xs text-fg-muted">{garminEntries.length} logged</span>
          </CardHeader>
          <CardBody className="space-y-4">
            <GarminEntryForm
              onSaved={() => {
                reloadGarmin();
              }}
            />
            {garminEntries.length === 0 ? (
              <p className="text-xs text-fg-muted">
                No entries yet. Log today's Body Battery / HRV / resting HR / sleep from your watch.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {garminEntries.slice(0, 7).map((e) => (
                  <li key={e.date} className="flex items-center justify-between py-2">
                    <div className="text-sm">
                      <div className="font-medium">{e.date}</div>
                      <div className="text-xs text-fg-muted">
                        {[
                          e.bodyBattery != null && `BB ${e.bodyBattery}`,
                          e.hrv != null && `HRV ${e.hrv}`,
                          e.restingHr != null && `RHR ${e.restingHr}`,
                          e.sleepHours != null && `${e.sleepHours}h sleep`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await window.atlas.garmin.deleteEntry(e.date);
                        reloadGarmin();
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function GarminEntryForm({ onSaved }: { onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [bodyBattery, setBodyBattery] = useState("");
  const [hrv, setHrv] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const entry: ManualGarminEntry = {
      date,
      bodyBattery: bodyBattery ? Number(bodyBattery) : undefined,
      hrv: hrv ? Number(hrv) : undefined,
      restingHr: restingHr ? Number(restingHr) : undefined,
      sleepHours: sleepHours ? Number(sleepHours) : undefined,
    };
    await window.atlas.garmin.addEntry(entry);
    setBodyBattery("");
    setHrv("");
    setRestingHr("");
    setSleepHours("");
    setBusy(false);
    onSaved();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-5 gap-2">
      <Field label="Date" value={date} onChange={setDate} type="date" />
      <Field label="Body Bat." value={bodyBattery} onChange={setBodyBattery} type="number" placeholder="0–100" />
      <Field label="HRV" value={hrv} onChange={setHrv} type="number" placeholder="ms" />
      <Field label="Rest HR" value={restingHr} onChange={setRestingHr} type="number" placeholder="bpm" />
      <Field label="Sleep" value={sleepHours} onChange={setSleepHours} type="number" placeholder="hrs" />
      <div className="col-span-5">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Log entry"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-fg-muted">{label}</span>
      <input
        type={type}
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
