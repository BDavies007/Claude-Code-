import { Badge, type BadgeProps } from "@/components/ui/badge";
import { humanize } from "@/lib/utils";
import type {
  TaskStatus,
  TaskPriority,
  DecisionStatus,
  MeetingStatus,
  OpportunityStage,
  RiskLevel,
} from "@/lib/types/database";

type Variant = BadgeProps["variant"];

const taskStatus: Record<TaskStatus, Variant> = {
  todo: "neutral",
  in_progress: "default",
  blocked: "danger",
  done: "success",
};

const priority: Record<TaskPriority, Variant> = {
  low: "neutral",
  medium: "default",
  high: "warning",
  critical: "danger",
};

const decisionStatus: Record<DecisionStatus, Variant> = {
  proposed: "default",
  approved: "success",
  rejected: "danger",
  deferred: "warning",
};

const meetingStatus: Record<MeetingStatus, Variant> = {
  scheduled: "default",
  completed: "success",
  cancelled: "neutral",
};

const stage: Record<OpportunityStage, Variant> = {
  prospect: "neutral",
  qualified: "default",
  proposal: "default",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

const riskLevel: Record<RiskLevel, Variant> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

export const TaskStatusBadge = ({ value }: { value: TaskStatus }) => (
  <Badge variant={taskStatus[value]}>{humanize(value)}</Badge>
);
export const PriorityBadge = ({ value }: { value: TaskPriority }) => (
  <Badge variant={priority[value]}>{humanize(value)}</Badge>
);
export const DecisionStatusBadge = ({ value }: { value: DecisionStatus }) => (
  <Badge variant={decisionStatus[value]}>{humanize(value)}</Badge>
);
export const MeetingStatusBadge = ({ value }: { value: MeetingStatus }) => (
  <Badge variant={meetingStatus[value]}>{humanize(value)}</Badge>
);
export const StageBadge = ({ value }: { value: OpportunityStage }) => (
  <Badge variant={stage[value]}>{humanize(value)}</Badge>
);
export const RiskLevelBadge = ({ value }: { value: RiskLevel }) => (
  <Badge variant={riskLevel[value]}>{humanize(value)}</Badge>
);
