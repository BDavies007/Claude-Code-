import { contextBridge, ipcRenderer } from "electron";

function crud<T>(table: string) {
  return {
    list: () => ipcRenderer.invoke(`db:${table}:list`) as Promise<T[]>,
    add: (item: T) => ipcRenderer.invoke(`db:${table}:add`, item) as Promise<T[]>,
    delete: (id: string) => ipcRenderer.invoke(`db:${table}:delete`, id) as Promise<T[]>,
    replaceAll: (items: T[]) => ipcRenderer.invoke(`db:${table}:replaceAll`, items) as Promise<T[]>,
  };
}

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
      ipcRenderer.invoke("google:connect", { clientId, clientSecret }),
    disconnect: () => ipcRenderer.invoke("google:disconnect"),
    status: () => ipcRenderer.invoke("google:status"),
    listMessages: (limit?: number) => ipcRenderer.invoke("gmail:listMessages", { limit }),
    listEvents: (rangeDays?: number) => ipcRenderer.invoke("gcal:listEvents", { rangeDays }),
  },
  microsoft: {
    connect: (clientId: string, clientSecret?: string, tenant?: string) =>
      ipcRenderer.invoke("microsoft:connect", { clientId, clientSecret, tenant }),
    disconnect: () => ipcRenderer.invoke("microsoft:disconnect"),
    status: () => ipcRenderer.invoke("microsoft:status"),
    listMessages: (limit?: number) => ipcRenderer.invoke("outlook:listMessages", { limit }),
    listEvents: (rangeDays?: number) => ipcRenderer.invoke("outlook:listEvents", { rangeDays }),
  },
  whoop: {
    connect: (clientId: string, clientSecret?: string) =>
      ipcRenderer.invoke("whoop:connect", { clientId, clientSecret }),
    disconnect: () => ipcRenderer.invoke("whoop:disconnect"),
    status: () => ipcRenderer.invoke("whoop:status"),
    recovery: () => ipcRenderer.invoke("whoop:recovery"),
    cycle: () => ipcRenderer.invoke("whoop:cycle"),
    sleep: () => ipcRenderer.invoke("whoop:sleep"),
  },
  garmin: {
    listEntries: () => ipcRenderer.invoke("garmin:listEntries"),
    addEntry: (entry: unknown) => ipcRenderer.invoke("garmin:addEntry", entry),
    deleteEntry: (date: string) => ipcRenderer.invoke("garmin:deleteEntry", date),
  },
  db: {
    finance: crud("finance"),
    crm: crud("crm"),
    projects: crud("projects"),
  },
  ai: {
    status: () => ipcRenderer.invoke("ai:status") as Promise<{ configured: boolean }>,
    setKey: (apiKey: string) => ipcRenderer.invoke("ai:setKey", apiKey) as Promise<boolean>,
    clearKey: () => ipcRenderer.invoke("ai:clearKey") as Promise<boolean>,
    generateBrief: (streamId: string, input: unknown) =>
      ipcRenderer.invoke("ai:generateBrief", { streamId, input }) as Promise<boolean>,
    cancelBrief: (streamId: string) =>
      ipcRenderer.invoke("ai:cancelBrief", streamId) as Promise<boolean>,
    onBriefEvent: (
      handler: (
        kind: "text" | "thinking" | "done" | "error",
        streamId: string,
        payload: unknown,
      ) => void,
    ) => {
      const kinds = {
        "ai:brief:text": "text",
        "ai:brief:thinking": "thinking",
        "ai:brief:done": "done",
        "ai:brief:error": "error",
      } as const;
      type Channel = keyof typeof kinds;
      type Msg = { streamId: string; payload: unknown };

      const subscribe = (ch: Channel) => {
        const fn = (_event: Electron.IpcRendererEvent, msg: Msg) =>
          handler(kinds[ch], msg.streamId, msg.payload);
        ipcRenderer.on(ch, fn);
        return () => ipcRenderer.off(ch, fn);
      };

      const offs = (Object.keys(kinds) as Channel[]).map(subscribe);
      return () => offs.forEach((off) => off());
    },
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld("atlas", api);

export type AtlasApi = typeof api;
