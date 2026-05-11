import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Store from "electron-store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";

type AppSettings = {
  pinHash?: string;
  theme: "light" | "dark" | "system";
  integrations: {
    whoop?: { accessToken?: string; refreshToken?: string };
    garmin?: { accessToken?: string; refreshToken?: string };
    outlook?: { accessToken?: string; refreshToken?: string };
    gmail?: { accessToken?: string; refreshToken?: string };
  };
};

const store = new Store<AppSettings>({
  name: "atlas-hub",
  defaults: {
    theme: "system",
    integrations: {},
  },
  // electron-store encrypts at rest with this key on supported platforms.
  encryptionKey: "atlas-hub-local-v1",
});

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
    const hash = await hashPin(pin);
    store.set("pinHash", hash);
    return true;
  });
  ipcMain.handle("auth:verifyPin", async (_e, pin: string) => {
    const stored = store.get("pinHash");
    if (!stored) return false;
    const candidate = await hashPin(pin);
    return candidate === stored;
  });
  ipcMain.handle("auth:clearPin", () => {
    store.delete("pinHash");
    return true;
  });

  ipcMain.handle("shell:openExternal", (_e, url: string) => shell.openExternal(url));
}

async function hashPin(pin: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`atlas-hub:${pin}`).digest("hex");
}
