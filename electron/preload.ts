import { contextBridge, ipcRenderer } from "electron";

const api = {
  settings: {
    get: (key: string) => ipcRenderer.invoke("settings:get", key),
    set: (key: string, value: unknown) => ipcRenderer.invoke("settings:set", key, value),
    all: () => ipcRenderer.invoke("settings:all"),
  },
  auth: {
    hasPin: () => ipcRenderer.invoke("auth:hasPin") as Promise<boolean>,
    setPin: (pin: string) => ipcRenderer.invoke("auth:setPin", pin) as Promise<boolean>,
    verifyPin: (pin: string) => ipcRenderer.invoke("auth:verifyPin", pin) as Promise<boolean>,
    clearPin: () => ipcRenderer.invoke("auth:clearPin") as Promise<boolean>,
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
  },
  google: {
    connect: (clientId: string, clientSecret?: string) =>
      ipcRenderer.invoke("google:connect", { clientId, clientSecret }) as Promise<{
        connected: boolean;
      }>,
    disconnect: () => ipcRenderer.invoke("google:disconnect") as Promise<boolean>,
    status: () =>
      ipcRenderer.invoke("google:status") as Promise<{
        connected: boolean;
        expiresAt?: number;
        scope?: string;
      }>,
    listMessages: (limit?: number) =>
      ipcRenderer.invoke("gmail:listMessages", { limit }) as Promise<unknown[]>,
    listEvents: (rangeDays?: number) =>
      ipcRenderer.invoke("gcal:listEvents", { rangeDays }) as Promise<unknown[]>,
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld("atlas", api);

export type AtlasApi = typeof api;
