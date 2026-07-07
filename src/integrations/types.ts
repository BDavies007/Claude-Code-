export interface RecoveryReading {
  source: "whoop" | "garmin";
  date: string;
  score: number;
  restingHr?: number;
  hrv?: number;
  sleepHours?: number;
  strain?: number;
}

export interface CalendarEvent {
  source: "outlook" | "gmail" | "manual";
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
}

export interface InboxMessage {
  source: "outlook" | "gmail";
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  unread: boolean;
  priority?: "high" | "normal" | "low";
}

export interface IntegrationStatus {
  connected: boolean;
  lastSync?: string;
  error?: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
  help?: string;
  required?: boolean;
}

export interface IntegrationAdapter {
  readonly id: "whoop" | "garmin" | "outlook" | "gmail";
  readonly label: string;
  readonly configFields?: ConfigField[];
  status(): Promise<IntegrationStatus>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface HealthAdapter extends IntegrationAdapter {
  recovery(date?: Date): Promise<RecoveryReading | null>;
}

export interface MailAdapter extends IntegrationAdapter {
  recentMessages(limit?: number): Promise<InboxMessage[]>;
}

export interface CalendarAdapter extends IntegrationAdapter {
  upcomingEvents(rangeDays?: number): Promise<CalendarEvent[]>;
}
