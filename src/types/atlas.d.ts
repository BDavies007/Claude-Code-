export type Integration = "whoop" | "garmin" | "outlook" | "gmail";

export interface IntegrationTokens {
  accessToken?: string;
  refreshToken?: string;
}

export interface AtlasApi {
  settings: {
    get: <T = unknown>(key: string) => Promise<T>;
    set: (key: string, value: unknown) => Promise<boolean>;
    all: () => Promise<Record<string, unknown>>;
  };
  auth: {
    hasPin: () => Promise<boolean>;
    setPin: (pin: string) => Promise<boolean>;
    verifyPin: (pin: string) => Promise<boolean>;
    clearPin: () => Promise<boolean>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    atlas: AtlasApi;
  }
}
