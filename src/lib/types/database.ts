// ════════════════════════════════════════════════════════════════════
// Typed database models for Executive OS.
//
// These mirror the SQL schema in `supabase/migrations/0001_init.sql`.
// The `Database` type is compatible with `@supabase/supabase-js` generics
// so `createClient<Database>()` gives you fully-typed queries.
// ════════════════════════════════════════════════════════════════════

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type DecisionStatus = "proposed" | "approved" | "rejected" | "deferred";
export type MeetingStatus = "scheduled" | "completed" | "cancelled";
export type OpportunityStage =
  | "prospect"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type Profile = {
  id: string;
  full_name: string | null;
  title: string | null;
  company_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Company = {
  id: string;
  user_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  size: string | null;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Contact = {
  id: string;
  user_id: string;
  company_id: string | null;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type Meeting = {
  id: string;
  user_id: string;
  company_id: string | null;
  title: string;
  status: MeetingStatus;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  attendees: string[];
  agenda: string | null;
  notes: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export type Task = {
  id: string;
  user_id: string;
  company_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee: string | null;
  created_at: string;
  updated_at: string;
}

export type Decision = {
  id: string;
  user_id: string;
  company_id: string | null;
  title: string;
  context: string | null;
  options: string | null;
  decision: string | null;
  rationale: string | null;
  status: DecisionStatus;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Opportunity = {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  stage: OpportunityStage;
  value: number | null;
  currency: string;
  probability: number | null;
  close_date: string | null;
  owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type Risk = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  level: RiskLevel;
  mitigation: string | null;
  is_open: boolean;
  created_at: string;
  updated_at: string;
}

export type DailyBrief = {
  id: string;
  user_id: string;
  brief_date: string;
  headline: string | null;
  summary: string | null;
  highlights: string[];
  created_at: string;
  updated_at: string;
}

export type AiAgent = {
  id: string;
  user_id: string;
  name: string;
  role: string;
  description: string | null;
  status: string;
  accent: string | null;
  last_active: string | null;
  created_at: string;
  updated_at: string;
}

// ── Convenience joins ───────────────────────────────────────────────
export type ContactWithCompany = Contact & { company: Company | null };
export type MeetingWithCompany = Meeting & { company: Company | null };
export type OpportunityWithCompany = Opportunity & { company: Company | null };

// ── Supabase generic helper types ──────────────────────────────────
type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

type TableShape<T> = {
  Row: Row<T>;
  Insert: Insert<T>;
  Update: Update<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<Profile>;
      companies: TableShape<Company>;
      contacts: TableShape<Contact>;
      meetings: TableShape<Meeting>;
      tasks: TableShape<Task>;
      decisions: TableShape<Decision>;
      opportunities: TableShape<Opportunity>;
      risks: TableShape<Risk>;
      daily_briefs: TableShape<DailyBrief>;
      ai_agents: TableShape<AiAgent>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      task_status: TaskStatus;
      task_priority: TaskPriority;
      decision_status: DecisionStatus;
      meeting_status: MeetingStatus;
      opportunity_stage: OpportunityStage;
      risk_level: RiskLevel;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
