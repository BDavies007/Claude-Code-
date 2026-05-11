import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Store from "electron-store";
import { startGoogleOAuth, refreshGoogleToken, GoogleTokens } from "./oauth/google.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";

interface GoogleIntegration {
  clientId: string;
  clientSecret?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
}

type AppSettings = {
  pinHash?: string;
  theme: "light" | "dark" | "system";
  integrations: {
    whoop?: { accessToken?: string; refreshToken?: string };
    garmin?: { accessToken?: string; refreshToken?: string };
    outlook?: { accessToken?: string; refreshToken?: string };
    gmail?: GoogleIntegration;
  };
};

const store = new Store<AppSettings>({
  name: "atlas-hub",
  defaults: {
    theme: "system",
    integrations: {},
  },
  encryptionKey: "atlas-hub-local-v1",
});

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
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

  ipcMain.handle(
    "google:connect",
    async (_e, args: { clientId: string; clientSecret?: string }) => {
      const tokens = await startGoogleOAuth({
        clientId: args.clientId,
        clientSecret: args.clientSecret,
        scopes: GOOGLE_SCOPES,
      });
      saveGoogleTokens(args.clientId, args.clientSecret, tokens);
      return { connected: true };
    },
  );

  ipcMain.handle("google:disconnect", () => {
    const integrations = store.get("integrations");
    store.set("integrations", { ...integrations, gmail: undefined });
    return true;
  });

  ipcMain.handle("google:status", () => {
    const g = store.get("integrations").gmail;
    return {
      connected: !!g?.accessToken,
      expiresAt: g?.expiresAt,
      scope: g?.scope,
    };
  });

  ipcMain.handle("gmail:listMessages", async (_e, opts: { limit?: number } = {}) => {
    const token = await ensureGoogleAccessToken();
    if (!token) return [];
    const limit = clamp(opts.limit ?? 10, 1, 25);

    const listRes = await googleFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=in:inbox`,
      token,
    );
    const list = (await listRes.json()) as { messages?: { id: string }[] };
    if (!list.messages?.length) return [];

    const details = await Promise.all(
      list.messages.map(async (m) => {
        const r = await googleFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}` +
            "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date",
          token,
        );
        return r.json();
      }),
    );
    return details;
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
    const r = await googleFetch(url.toString(), token);
    const json = (await r.json()) as { items?: unknown[] };
    return json.items ?? [];
  });
}

function saveGoogleTokens(clientId: string, clientSecret: string | undefined, t: GoogleTokens) {
  const integrations = store.get("integrations");
  store.set("integrations", {
    ...integrations,
    gmail: {
      clientId,
      clientSecret,
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      expiresAt: t.expiresAt,
      scope: t.scope,
    },
  });
}

async function ensureGoogleAccessToken(): Promise<string | null> {
  const integrations = store.get("integrations");
  const g = integrations.gmail;
  if (!g?.accessToken) return null;

  // Refresh if expiring within 60s
  if (g.expiresAt && g.expiresAt - Date.now() < 60_000 && g.refreshToken) {
    try {
      const refreshed = await refreshGoogleToken({
        clientId: g.clientId,
        clientSecret: g.clientSecret,
        refreshToken: g.refreshToken,
      });
      saveGoogleTokens(g.clientId, g.clientSecret, refreshed);
      return refreshed.accessToken;
    } catch (err) {
      console.error("Google token refresh failed:", err);
      return null;
    }
  }
  return g.accessToken;
}

async function googleFetch(url: string, token: string): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Google API ${res.status}: ${await res.text()}`);
  }
  return res;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

async function hashPin(pin: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`atlas-hub:${pin}`).digest("hex");
}
