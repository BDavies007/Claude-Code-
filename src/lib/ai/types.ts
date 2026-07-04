import type {
  Task,
  Meeting,
  Risk,
  Opportunity,
  Decision,
} from "@/lib/types/database";

/** Everything the brief generator needs to reason about the day. */
export interface BriefContext {
  fullName: string;
  companyName: string;
  date: string;
  tasks: Task[];
  meetings: Meeting[];
  risks: Risk[];
  opportunities: Opportunity[];
  decisions: Decision[];
}

export interface BriefResult {
  headline: string;
  summary: string;
  highlights: string[];
  /** Which provider produced this brief: "anthropic" | "openai" | "mock". */
  provider: string;
}

export interface AiProvider {
  name: string;
  generateBrief(context: BriefContext): Promise<BriefResult>;
}
