import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Store from "electron-store";
import { startGoogleOAuth, refreshGoogleToken } from "./oauth/google.js";
import { startMicrosoftOAuth, refreshMicrosoftToken } from "./oauth/microsoft.js";
import { startWhoopOAuth, refreshWhoopToken } from "./oauth/whoop.js";
import { PkceTokens } from "./oauth/pkce.js";
import { AnthropicService, BriefInput } from "./ai/anthropic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";

interface OAuthIntegration {
  clientId: string;
  clientSecret?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

interface ManualGarminEntry {
  date: string; // YYYY-MM-DD
  score?: number;
  restingHr?: number;
  hrv?: number;
  sleepHours?: number;
  bodyBattery?: number;
  stress?: number;
  notes?: string;
}

type AppSettings = {
  pinHash?: string;
  theme: "light" | "dark" | "system";
  integrations: {
    whoop?: OAuthIntegration;
    garmin?: { entries?: ManualGarminEntry[] };
    outlook?: OAuthIntegration;
    gmail?: OAuthIntegration;
  };
  anthropic?: { apiKey?: string };
};

const store = new Store<AppSettings>({
  name: "atlas-hub",
  defaults: { theme: "system", integrations: {} },
  encryptionKey: "atlas-hub-local-v1",
});

const anthropic = new AnthropicService();
anthropic.setApiKey(store.get("anthropic")?.apiKey);

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const MICROSOFT_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.Read",
  "Calendars.Read",
];

const WHOOP_SCOPES = [
  "offline",
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:profile",
];

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0b0d12",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function registerIpc() {
  // ---------- core ----------
  ipcMain.handle("settings:get", (_e, key: keyof AppSettings) => store.get(key));
  ipcMain.handle("settings:set", (_e, key: keyof AppSettings, value: unknown) => {
    store.set(key, value as never);
    return true;
  });
  ipcMain.handle("settings:all", () => store.store);

  ipcMain.handle("auth:hasPin", () => !!store.get("pinHash"));
  ipcMain.handle("auth:setPin", async (_e, pin: string) => {
    store.set("pinHash", await hashPin(pin));
    return true;
  });
  ipcMain.handle("auth:verifyPin", async (_e, pin: string) => {
    const stored = store.get("pinHash");
    if (!stored) return false;
    return (await hashPin(pin)) === stored;
  });
  ipcMain.handle("auth:clearPin", () => {
    store.delete("pinHash");
    return true;
  });

  ipcMain.handle("shell:openExternal", (_e, url: string) => shell.openExternal(url));

  // ---------- google ----------
  ipcMain.handle("google:connect", async (_e, args: { clientId: string; clientSecret?: string }) => {
    const tokens = await startGoogleOAuth({ ...args, scopes: GOOGLE_SCOPES });
    saveOAuth("gmail", args.clientId, args.clientSecret, tokens);
    return { connected: true };
  });
  ipcMain.handle("google:disconnect", () => clearOAuth("gmail"));
  ipcMain.handle("google:status", () => statusFor("gmail"));

  ipcMain.handle("gmail:listMessages", async (_e, opts: { limit?: number } = {}) => {
    const token = await ensureGoogleAccessToken();
    if (!token) return [];
    const limit = clamp(opts.limit ?? 10, 1, 25);
    const listRes = await bearerFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=in:inbox`,
      token,
      "Gmail",
    );
    const list = (await listRes.json()) as { messages?: { id: string }[] };
    if (!list.messages?.length) return [];
    return Promise.all(
      list.messages.map(async (m) => {
        const r = await bearerFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}` +
            "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date",
          token,
          "Gmail",
        );
        return r.json();
      }),
    );
  });

  ipcMain.handle("gcal:listEvents", async (_e, opts: { rangeDays?: number } = {}) => {
    const token = await ensureGoogleAccessToken();
    if (!token) return [];
    const days = clamp(opts.rangeDays ?? 7, 1, 60);
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", new Date().toISOString());
    url.searchParams.set("timeMax", new Date(Date.now() + days * 86_400_000).toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "50");
    const r = await bearerFetch(url.toString(), token, "Google Calendar");
    return ((await r.json()) as { items?: unknown[] }).items ?? [];
  });

  // ---------- microsoft (outlook) ----------
  ipcMain.handle(
    "microsoft:connect",
    async (_e, args: { clientId: string; clientSecret?: string; tenant?: string }) => {
      const tokens = await startMicrosoftOAuth({ ...args, scopes: MICROSOFT_SCOPES });
      saveOAuth("outlook", args.clientId, args.clientSecret, tokens, { tenant: args.tenant });
      return { connected: true };
    },
  );
  ipcMain.handle("microsoft:disconnect", () => clearOAuth("outlook"));
  ipcMain.handle("microsoft:status", () => statusFor("outlook"));

  ipcMain.handle("outlook:listMessages", async (_e, opts: { limit?: number } = {}) => {
    const token = await ensureMicrosoftAccessToken();
    if (!token) return [];
    const top = clamp(opts.limit ?? 10, 1, 25);
    const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
    url.searchParams.set("$top", String(top));
    url.searchParams.set("$select", "id,subject,from,bodyPreview,receivedDateTime,isRead,importance");
    url.searchParams.set("$orderby", "receivedDateTime DESC");
    const r = await bearerFetch(url.toString(), token, "Microsoft Graph");
    return ((await r.json()) as { value?: unknown[] }).value ?? [];
  });

  ipcMain.handle("outlook:listEvents", async (_e, opts: { rangeDays?: number } = {}) => {
    const token = await ensureMicrosoftAccessToken();
    if (!token) return [];
    const days = clamp(opts.rangeDays ?? 7, 1, 60);
    const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
    url.searchParams.set("startDateTime", new Date().toISOString());
    url.searchParams.set("endDateTime", new Date(Date.now() + days * 86_400_000).toISOString());
    url.searchParams.set("$top", "50");
    url.searchParams.set("$select", "id,subject,start,end,location,attendees,bodyPreview");
    url.searchParams.set("$orderby", "start/dateTime");
    const r = await bearerFetch(url.toString(), token, "Microsoft Graph");
    return ((await r.json()) as { value?: unknown[] }).value ?? [];
  });

  // ---------- whoop ----------
  ipcMain.handle("whoop:connect", async (_e, args: { clientId: string; clientSecret?: string }) => {
    const tokens = await startWhoopOAuth({ ...args, scopes: WHOOP_SCOPES });
    saveOAuth("whoop", args.clientId, args.clientSecret, tokens);
    return { connected: true };
  });
  ipcMain.handle("whoop:disconnect", () => clearOAuth("whoop"));
  ipcMain.handle("whoop:status", () => statusFor("whoop"));

  ipcMain.handle("whoop:recovery", async () => {
    const token = await ensureWhoopAccessToken();
    if (!token) return null;
    // The most recent recovery
    const r = await bearerFetch(
      "https://api.prod.whoop.com/developer/v1/recovery?limit=1",
      token,
      "Whoop",
    );
    const json = (await r.json()) as { records?: unknown[] };
    return json.records?.[0] ?? null;
  });

  ipcMain.handle("whoop:cycle", async () => {
    const token = await ensureWhoopAccessToken();
    if (!token) return null;
    const r = await bearerFetch(
      "https://api.prod.whoop.com/developer/v1/cycle?limit=1",
      token,
      "Whoop",
    );
    const json = (await r.json()) as { records?: unknown[] };
    return json.records?.[0] ?? null;
  });

  ipcMain.handle("whoop:sleep", async () => {
    const token = await ensureWhoopAccessToken();
    if (!token) return null;
    const r = await bearerFetch(
      "https://api.prod.whoop.com/developer/v1/activity/sleep?limit=1",
      token,
      "Whoop",
    );
    const json = (await r.json()) as { records?: unknown[] };
    return json.records?.[0] ?? null;
  });

  // ---------- garmin (manual entry) ----------
  ipcMain.handle("garmin:listEntries", () => {
    return store.get("integrations").garmin?.entries ?? [];
  });
  ipcMain.handle("garmin:addEntry", (_e, entry: ManualGarminEntry) => {
    const integrations = store.get("integrations");
    const existing = integrations.garmin?.entries ?? [];
    const filtered = existing.filter((e) => e.date !== entry.date);
    const next = [...filtered, entry].sort((a, b) => b.date.localeCompare(a.date));
    store.set("integrations", { ...integrations, garmin: { entries: next } });
    return next;
  });
  ipcMain.handle("garmin:deleteEntry", (_e, date: string) => {
    const integrations = store.get("integrations");
    const next = (integrations.garmin?.entries ?? []).filter((e) => e.date !== date);
    store.set("integrations", { ...integrations, garmin: { entries: next } });
    return next;
  });

  // ---------- AI ----------
  ipcMain.handle("ai:status", () => ({ configured: anthropic.isConfigured() }));

  ipcMain.handle("ai:setKey", (_e, apiKey: string) => {
    store.set("anthropic", { apiKey });
    anthropic.setApiKey(apiKey);
    return true;
  });

  ipcMain.handle("ai:clearKey", () => {
    store.delete("anthropic");
    anthropic.setApiKey(undefined);
    return true;
  });

  ipcMain.handle(
    "ai:generateBrief",
    async (e, args: { streamId: string; input: BriefInput }) => {
      const wc = e.sender;
      const { streamId, input } = args;
      const send = (channel: string, payload: unknown) => {
        if (!wc.isDestroyed()) wc.send(channel, { streamId, payload });
      };
      await anthropic.generateBrief(streamId, input, {
        onText: (delta) => send("ai:brief:text", delta),
        onThinking: (delta) => send("ai:brief:thinking", delta),
        onDone: (final) => send("ai:brief:done", final),
        onError: (msg) => send("ai:brief:error", msg),
      });
      return true;
    },
  );

  ipcMain.handle("ai:cancelBrief", (_e, streamId: string) => {
    anthropic.cancel(streamId);
    return true;
  });

  // ---------- persistence: finance, crm, projects ----------
  registerCrud<Transaction>("finance");
  registerCrud<Client>("crm");
  registerCrud<Project>("projects");
}

// ----- generic OAuth helpers -----

function saveOAuth(
  key: "gmail" | "outlook" | "whoop",
  clientId: string,
  clientSecret: string | undefined,
  t: PkceTokens,
  extras: Record<string, unknown> = {},
) {
  const integrations = store.get("integrations");
  store.set("integrations", {
    ...integrations,
    [key]: {
      ...extras,
      clientId,
      clientSecret,
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      expiresAt: t.expiresAt,
      scope: t.scope,
    },
  });
}

function clearOAuth(key: "gmail" | "outlook" | "whoop") {
  const integrations = store.get("integrations");
  store.set("integrations", { ...integrations, [key]: undefined });
  return true;
}

function statusFor(key: "gmail" | "outlook" | "whoop") {
  const v = store.get("integrations")[key] as OAuthIntegration | undefined;
  return {
    connected: !!v?.accessToken,
    expiresAt: v?.expiresAt,
    scope: v?.scope,
  };
}

async function ensureGoogleAccessToken(): Promise<string | null> {
  const g = store.get("integrations").gmail;
  if (!g?.accessToken) return null;
  if (g.expiresAt && g.expiresAt - Date.now() < 60_000 && g.refreshToken) {
    try {
      const refreshed = await refreshGoogleToken({
        clientId: g.clientId,
        clientSecret: g.clientSecret,
        refreshToken: g.refreshToken,
      });
      saveOAuth("gmail", g.clientId, g.clientSecret, refreshed);
      return refreshed.accessToken;
    } catch (err) {
      console.error("Google token refresh failed:", err);
      return null;
    }
  }
  return g.accessToken;
}

async function ensureMicrosoftAccessToken(): Promise<string | null> {
  const m = store.get("integrations").outlook as
    | (OAuthIntegration & { tenant?: string })
    | undefined;
  if (!m?.accessToken) return null;
  if (m.expiresAt && m.expiresAt - Date.now() < 60_000 && m.refreshToken) {
    try {
      const refreshed = await refreshMicrosoftToken({
        clientId: m.clientId,
        clientSecret: m.clientSecret,
        refreshToken: m.refreshToken,
        scopes: MICROSOFT_SCOPES,
        tenant: m.tenant,
      });
      saveOAuth("outlook", m.clientId, m.clientSecret, refreshed, { tenant: m.tenant });
      return refreshed.accessToken;
    } catch (err) {
      console.error("Microsoft token refresh failed:", err);
      return null;
    }
  }
  return m.accessToken;
}

async function ensureWhoopAccessToken(): Promise<string | null> {
  const w = store.get("integrations").whoop;
  if (!w?.accessToken) return null;
  if (w.expiresAt && w.expiresAt - Date.now() < 60_000 && w.refreshToken) {
    try {
      const refreshed = await refreshWhoopToken({
        clientId: w.clientId,
        clientSecret: w.clientSecret,
        refreshToken: w.refreshToken,
      });
      saveOAuth("whoop", w.clientId, w.clientSecret, refreshed);
      return refreshed.accessToken;
    } catch (err) {
      console.error("Whoop token refresh failed:", err);
      return null;
    }
  }
  return w.accessToken;
}

async function bearerFetch(url: string, token: string, label: string): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`${label} ${res.status}: ${await res.text()}`);
  }
  return res;
}

// ----- simple JSON-backed CRUD tables -----

interface Identifiable {
  id: string;
}

interface Transaction extends Identifiable {
  date: string;
  desc: string;
  amount: number;
  category: string;
}
interface Client extends Identifiable {
  name: string;
  stage: string;
  value: number;
  owner: string;
  notes?: string;
}
interface Project extends Identifiable {
  name: string;
  status: "On track" | "At risk" | "Blocked" | "Done";
  due: string;
  owner: string;
}

const dbStores: Record<string, Store<{ items: Identifiable[] }>> = {};

function dbStore(table: string): Store<{ items: Identifiable[] }> {
  if (!dbStores[table]) {
    dbStores[table] = new Store<{ items: Identifiable[] }>({
      name: `atlas-hub-${table}`,
      defaults: { items: [] },
      encryptionKey: "atlas-hub-local-v1",
    });
  }
  return dbStores[table];
}

function registerCrud<T extends Identifiable>(table: string) {
  ipcMain.handle(`db:${table}:list`, () => dbStore(table).get("items") as T[]);
  ipcMain.handle(`db:${table}:add`, (_e, item: T) => {
    const items = dbStore(table).get("items") as T[];
    const next = [item, ...items.filter((i) => i.id !== item.id)];
    dbStore(table).set("items", next);
    return next;
  });
  ipcMain.handle(`db:${table}:delete`, (_e, id: string) => {
    const items = dbStore(table).get("items") as T[];
    const next = items.filter((i) => i.id !== id);
    dbStore(table).set("items", next);
    return next;
  });
  ipcMain.handle(`db:${table}:replaceAll`, (_e, items: T[]) => {
    dbStore(table).set("items", items);
    return items;
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

async function hashPin(pin: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`atlas-hub:${pin}`).digest("hex");
}
