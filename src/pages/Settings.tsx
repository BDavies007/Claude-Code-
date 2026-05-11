import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { allAdapters } from "@/integrations";
import type { IntegrationAdapter, IntegrationStatus } from "@/integrations/types";
import { useTheme } from "@/lib/theme";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">Integrations, security, and appearance.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <span className="text-xs text-fg-muted">Tokens stored locally, encrypted at rest</span>
        </CardHeader>
        <CardBody className="space-y-3">
          {allAdapters.map((a) => (
            <IntegrationRow key={a.id} adapter={a} />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <Button
                key={t}
                variant={theme === t ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTheme(t)}
                className="capitalize"
              >
                {t}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              if (!confirm("Remove the device PIN? The app will be unlocked.")) return;
              await window.atlas.auth.clearPin();
              location.reload();
            }}
          >
            Reset device PIN
          </Button>
          <p className="text-xs text-fg-muted">
            PIN is hashed (SHA-256) and stored only on this device. Use OS keychain for production-grade
            secrets.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function IntegrationRow({ adapter }: { adapter: IntegrationAdapter }) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => adapter.status().then(setStatus);

  useEffect(() => {
    refresh();
  }, [adapter]);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await adapter.connect();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    await adapter.disconnect();
    await refresh();
    setBusy(false);
  };

  const connected = status?.connected ?? false;

  return (
    <div className="flex items-start justify-between rounded-lg border border-border bg-bg p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{adapter.label}</span>
          <span
            className={
              "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide " +
              (connected ? "bg-success/15 text-success" : "bg-bg-subtle text-fg-muted")
            }
          >
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
        {error && <div className="mt-1 text-xs text-danger">{error}</div>}
      </div>
      <div className="flex gap-2">
        {connected ? (
          <Button variant="secondary" size="sm" onClick={onDisconnect} disabled={busy}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={onConnect} disabled={busy}>
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
