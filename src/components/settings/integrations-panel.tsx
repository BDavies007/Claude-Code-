"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CONNECTORS } from "@/lib/integrations/registry";
import { disconnectGoogle, syncNow } from "@/lib/actions/integrations";
import type { SyncConnector } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const ACCENT: Record<string, string> = {
  sky: "bg-sky-500/15 text-sky-400",
  emerald: "bg-emerald-500/15 text-emerald-400",
  amber: "bg-amber-500/15 text-amber-400",
};

interface IntegrationsPanelProps {
  connected: boolean;
  email: string | null;
  configured: boolean;
  notice?: string | null;
}

export function IntegrationsPanel({
  connected,
  email,
  configured,
  notice,
}: IntegrationsPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState<SyncConnector | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function disconnect() {
    if (!window.confirm("Disconnect Google? Synced data stays; new syncs stop."))
      return;
    setBusy(true);
    await disconnectGoogle();
    setBusy(false);
    router.refresh();
  }

  async function runSync(connector: SyncConnector) {
    setSyncing(connector);
    setSyncMsg(null);
    const result = await syncNow(connector);
    setSyncing(null);
    if (result?.error) {
      setSyncMsg(result.error);
    } else {
      setSyncMsg("Sync complete.");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Google Workspace</p>
          <p className="text-xs text-muted-foreground">
            {connected
              ? `Connected${email ? ` · ${email}` : ""}`
              : "Connect once to enable Calendar, Drive, and Gmail."}
          </p>
        </div>
        {connected ? (
          <div className="flex items-center gap-2">
            <Badge variant="success">
              <Check className="mr-1 h-3 w-3" /> Connected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={disconnect}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Disconnect
            </Button>
          </div>
        ) : (
          <Button asChild size="sm" disabled={!configured}>
            <a href="/api/integrations/google/connect">
              <Plug className="h-4 w-4" /> Connect Google
            </a>
          </Button>
        )}
      </div>

      {notice === "connected" && (
        <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Google connected. Calendar, Drive, and Gmail sync can now run.
        </p>
      )}
      {notice === "not_configured" && (
        <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          Google OAuth isn&apos;t configured yet. Set{" "}
          <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> to
          enable connecting. See <code>docs/INTEGRATIONS.md</code>.
        </p>
      )}
      {notice && !["connected", "not_configured"].includes(notice) && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <X className="mr-1 inline h-3 w-3" /> Couldn&apos;t connect Google
          ({notice}). Please try again.
        </p>
      )}

      <Separator className="my-4" />

      <ul className="space-y-3">
        {CONNECTORS.map((c) => (
          <li key={c.key} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                ACCENT[c.accent] ?? ACCENT.sky,
              )}
            >
              {c.name[7] ?? c.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {c.name}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  → {c.target}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {c.description}
              </p>
            </div>
            {connected && c.live ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => runSync(c.key)}
                disabled={syncing !== null}
              >
                {syncing === c.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync now
              </Button>
            ) : (
              <Badge variant={c.live ? "success" : "neutral"}>
                {c.live ? (connected ? "Ready" : "Idle") : c.phase}
              </Badge>
            )}
          </li>
        ))}
      </ul>

      {syncMsg && (
        <p
          className={cn(
            "mt-3 rounded-md border px-3 py-2 text-sm",
            syncMsg === "Sync complete."
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400",
          )}
        >
          {syncMsg}
        </p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Scheduling and multi-step flows run through n8n — see{" "}
        <code>n8n/README.md</code>. Live sync activates once Google is connected
        and the n8n workflows are imported.
      </p>
    </div>
  );
}
