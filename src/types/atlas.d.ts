export type Integration = "whoop" | "garmin" | "outlook" | "gmail";

export interface IntegrationTokens {
  accessToken?: string;
  refreshToken?: string;
}

export interface GoogleStatus {
  connected: boolean;
  expiresAt?: number;
  scope?: string;
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
  google: {
    connect: (clientId: string, clientSecret?: string) => Promise<{ connected: boolean }>;
    disconnect: () => Promise<boolean>;
    status: () => Promise<GoogleStatus>;
    listMessages: (limit?: number) => Promise<GmailMessage[]>;
    listEvents: (rangeDays?: number) => Promise<GoogleCalendarEvent[]>;
  };
  platform: NodeJS.Platform;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
  };
}

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string }[];
  htmlLink?: string;
}

declare global {
  interface Window {
    atlas: AtlasApi;
  }
}
