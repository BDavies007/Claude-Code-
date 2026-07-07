export interface IntegrationStatusDto {
  connected: boolean;
  expiresAt?: number;
  scope?: string;
}

// --- Gmail / Google Calendar ---
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
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

// --- Microsoft Graph ---
export interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  isRead?: boolean;
  importance?: "low" | "normal" | "high";
  receivedDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
}
export interface GraphEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  location?: { displayName?: string };
  start?: { dateTime: string; timeZone?: string };
  end?: { dateTime: string; timeZone?: string };
  attendees?: { emailAddress?: { name?: string; address?: string } }[];
}

// --- Whoop ---
export interface WhoopRecoveryRecord {
  cycle_id?: number;
  sleep_id?: number;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
  };
}
export interface WhoopCycleRecord {
  id?: number;
  start?: string;
  end?: string;
  score?: { strain?: number; average_heart_rate?: number; max_heart_rate?: number };
}
export interface WhoopSleepRecord {
  id?: number;
  start?: string;
  end?: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
    };
    sleep_efficiency_percentage?: number;
  };
}

// --- Garmin (manual entry) ---
export interface ManualGarminEntry {
  date: string;
  score?: number;
  restingHr?: number;
  hrv?: number;
  sleepHours?: number;
  bodyBattery?: number;
  stress?: number;
  notes?: string;
}

// --- persistence shapes ---
export interface Transaction {
  id: string;
  date: string;
  desc: string;
  amount: number;
  category: string;
}
export interface CrmClient {
  id: string;
  name: string;
  stage: string;
  value: number;
  owner: string;
  notes?: string;
}
export interface ProjectRow {
  id: string;
  name: string;
  status: "On track" | "At risk" | "Blocked" | "Done";
  due: string;
  owner: string;
}

export interface CrudApi<T> {
  list: () => Promise<T[]>;
  add: (item: T) => Promise<T[]>;
  delete: (id: string) => Promise<T[]>;
  replaceAll: (items: T[]) => Promise<T[]>;
}

export interface BriefInput {
  date: string;
  recovery?: {
    source: "whoop" | "garmin";
    score: number;
    hrv?: number;
    sleepHours?: number;
    restingHr?: number;
    strain?: number;
  } | null;
  events: { time: string; title: string; source: string }[];
  priorityMessages: { from: string; subject: string; source: string }[];
  unreadCount: number;
  finance?: {
    incomeMonth: number;
    expenseMonth: number;
    netCash: number;
  };
  pipeline?: { stage: string; count: number; value: number }[];
  projects?: { name: string; status: string; due: string }[];
}

export type BriefEventKind = "text" | "thinking" | "done" | "error";

export interface BriefDonePayload {
  text: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
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
  shell: { openExternal: (url: string) => Promise<void> };
  google: {
    connect: (clientId: string, clientSecret?: string) => Promise<{ connected: boolean }>;
    disconnect: () => Promise<boolean>;
    status: () => Promise<IntegrationStatusDto>;
    listMessages: (limit?: number) => Promise<GmailMessage[]>;
    listEvents: (rangeDays?: number) => Promise<GoogleCalendarEvent[]>;
  };
  microsoft: {
    connect: (
      clientId: string,
      clientSecret?: string,
      tenant?: string,
    ) => Promise<{ connected: boolean }>;
    disconnect: () => Promise<boolean>;
    status: () => Promise<IntegrationStatusDto>;
    listMessages: (limit?: number) => Promise<GraphMessage[]>;
    listEvents: (rangeDays?: number) => Promise<GraphEvent[]>;
  };
  whoop: {
    connect: (clientId: string, clientSecret?: string) => Promise<{ connected: boolean }>;
    disconnect: () => Promise<boolean>;
    status: () => Promise<IntegrationStatusDto>;
    recovery: () => Promise<WhoopRecoveryRecord | null>;
    cycle: () => Promise<WhoopCycleRecord | null>;
    sleep: () => Promise<WhoopSleepRecord | null>;
  };
  garmin: {
    listEntries: () => Promise<ManualGarminEntry[]>;
    addEntry: (entry: ManualGarminEntry) => Promise<ManualGarminEntry[]>;
    deleteEntry: (date: string) => Promise<ManualGarminEntry[]>;
  };
  db: {
    finance: CrudApi<Transaction>;
    crm: CrudApi<CrmClient>;
    projects: CrudApi<ProjectRow>;
  };
  ai: {
    status: () => Promise<{ configured: boolean }>;
    setKey: (apiKey: string) => Promise<boolean>;
    clearKey: () => Promise<boolean>;
    generateBrief: (streamId: string, input: BriefInput) => Promise<boolean>;
    cancelBrief: (streamId: string) => Promise<boolean>;
    onBriefEvent: (
      handler: (kind: BriefEventKind, streamId: string, payload: unknown) => void,
    ) => () => void;
  };
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    atlas: AtlasApi;
  }
}
