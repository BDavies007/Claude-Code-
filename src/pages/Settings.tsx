import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
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

type AdapterWithConfig = IntegrationAdapter & {
  readConfig?: () => Promise<Record<string, string | undefined>>;
  writeConfig?: (cfg: Record<string, string | undefined>) => Promise<void>;
};

function IntegrationRow({ adapter }: { adapter: AdapterWithConfig }) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

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
      if (adapter.configFields) setExpanded(true);
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
  const configurable = adapter.configFields !== undefined;

  return (
    <div className="rounded-lg border border-border bg-bg">
      <div className="flex items-start justify-between p-3">
        <div className="min-w-0">
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
          {status?.lastSync && (
            <div className="mt-0.5 text-xs text-fg-muted">
              Token valid until {new Date(status.lastSync).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {configurable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              title="Configure"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Configure
            </Button>
          )}
          {connected ? (
            <Button variant="secondary" size="sm" onClick={onDisconnect} disabled={busy}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={onConnect} disabled={busy}>
              {busy ? "Connecting…" : "Connect"}
            </Button>
          )}
        </div>
      </div>

      {expanded && configurable && (
        <ConfigForm adapter={adapter} onSaved={() => refresh()} />
      )}
    </div>
  );
}

function ConfigForm({
  adapter,
  onSaved,
}: {
  adapter: AdapterWithConfig;
  onSaved: () => void;
}) {
  const fields = adapter.configFields ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!adapter.readConfig) return;
    adapter.readConfig().then((cfg) => {
      const next: Record<string, string> = {};
      for (const f of fields) next[f.key] = String(cfg[f.key] ?? "");
      setValues(next);
    });
  }, [adapter]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adapter.writeConfig) return;
    setSaving(true);
    await adapter.writeConfig(values);
    setSaving(false);
    setSavedAt(Date.now());
    onSaved();
  };

  return (
    <form onSubmit={save} className="space-y-3 border-t border-border bg-bg-subtle p-3">
      <SetupHelp id={adapter.id} />
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-fg-muted">
            {f.label}
            {f.required && <span className="ml-0.5 text-danger">*</span>}
          </label>
          <input
            type={f.type}
            value={values[f.key] ?? ""}
            placeholder={f.placeholder}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
          />
          {f.help && <p className="mt-1 text-[11px] text-fg-muted">{f.help}</p>}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {savedAt && <span className="text-xs text-success">Saved.</span>}
      </div>
    </form>
  );
}

function SetupHelp({ id }: { id: string }) {
  const link = (url: string, label: string) => (
    <button
      type="button"
      onClick={() => window.atlas.shell.openExternal(url)}
      className="inline-flex items-center gap-0.5 text-brand hover:underline"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </button>
  );

  if (id === "gmail") {
    return (
      <HelpCard>
        <ol className="list-decimal space-y-1 pl-4">
          <li>
            Open {link("https://console.cloud.google.com/apis/credentials", "Google Cloud Credentials")} and
            create an <strong>OAuth client ID</strong> of type <em>Desktop app</em>.
          </li>
          <li>
            Enable {link("https://console.cloud.google.com/apis/library/gmail.googleapis.com", "Gmail API")} and{" "}
            {link("https://console.cloud.google.com/apis/library/calendar-json.googleapis.com", "Calendar API")}
            {" "}in the same project.
          </li>
          <li>Paste Client ID + Secret, Save, then Connect.</li>
        </ol>
      </HelpCard>
    );
  }

  if (id === "outlook") {
    return (
      <HelpCard>
        <ol className="list-decimal space-y-1 pl-4">
          <li>
            Open {link("https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade", "Azure App Registrations")} and
            create a new app.
          </li>
          <li>
            Under <em>Authentication</em>, add a <strong>Mobile and desktop applications</strong> redirect URI of{" "}
            <code>http://localhost</code>. Enable <em>"Allow public client flows"</em>.
          </li>
          <li>
            Under <em>API permissions</em>, add Microsoft Graph delegated scopes:{" "}
            <code>User.Read</code>, <code>Mail.Read</code>, <code>Calendars.Read</code>,{" "}
            <code>offline_access</code>.
          </li>
          <li>
            Copy the Application (Client) ID and paste it below. Leave Client Secret blank for a public PKCE
            client. Tenant <code>common</code> works for both personal and work accounts.
          </li>
        </ol>
      </HelpCard>
    );
  }

  if (id === "whoop") {
    return (
      <HelpCard>
        <ol className="list-decimal space-y-1 pl-4">
          <li>
            Open {link("https://developer-dashboard.whoop.com/", "Whoop Developer Dashboard")} and create
            a new app.
          </li>
          <li>
            Add scopes: <code>offline</code>, <code>read:recovery</code>, <code>read:cycles</code>,{" "}
            <code>read:sleep</code>, <code>read:profile</code>. The <code>offline</code> scope is required for
            refresh tokens.
          </li>
          <li>
            Whoop requires registering an exact redirect URI. Add <code>http://localhost</code> if the
            dashboard supports wildcard ports for desktop apps; otherwise pick a fixed port (e.g.
            <code>http://localhost:51820/oauth2callback</code>) and we'll match it.
          </li>
          <li>Paste Client ID + Secret below, Save, then Connect.</li>
        </ol>
      </HelpCard>
    );
  }

  if (id === "garmin") {
    return (
      <HelpCard>
        Garmin doesn't expose a clean personal OAuth flow. Atlas Hub uses <strong>manual entry</strong>{" "}
        instead: open the Health page and log your morning Body Battery / HRV / resting HR / sleep from
        your watch. Those entries feed the Morning Brief just like the API would.
      </HelpCard>
    );
  }

  return null;
}

function HelpCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-bg p-3 text-xs leading-relaxed text-fg-muted">
      <div className="mb-1 font-medium text-fg">Setup</div>
      {children}
    </div>
  );
}
