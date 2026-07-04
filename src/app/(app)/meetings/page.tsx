import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCompanyOptions } from "@/lib/data/queries";
import { PageHeader } from "@/components/shared/page-header";
import {
  ResourceManager,
  type Field,
  type Column,
} from "@/components/shared/resource-manager";
import { MeetingStatusBadge } from "@/components/shared/status-badges";
import { formatDateTime } from "@/lib/utils";
import {
  createMeeting,
  updateMeeting,
  deleteMeeting,
} from "@/lib/actions/meetings";
import type { MeetingWithCompany } from "@/lib/types/database";

export const dynamic = "force-dynamic";

/** Convert an ISO timestamp to the value a datetime-local input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

export default async function MeetingsPage() {
  const supabase = createClient();
  const [{ data }, companyOptions] = await Promise.all([
    supabase
      .from("meetings")
      .select("*, company:companies(*)")
      .order("starts_at", { ascending: false }),
    getCompanyOptions(),
  ]);
  const meetings = (data ?? []) as unknown as MeetingWithCompany[];

  const fields: Field[] = [
    { name: "title", label: "Title", type: "text", required: true, full: true, placeholder: "Meeting title" },
    { name: "starts_at", label: "Starts", type: "datetime", required: true },
    { name: "ends_at", label: "Ends", type: "datetime" },
    {
      name: "status",
      label: "Status",
      type: "select",
      defaultValue: "scheduled",
      options: [
        { value: "scheduled", label: "Scheduled" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ],
    },
    { name: "location", label: "Location", type: "text", placeholder: "Room or video link" },
    { name: "company_id", label: "Company", type: "select", options: companyOptions, full: true },
    { name: "attendees", label: "Attendees", type: "text", full: true, placeholder: "Comma separated names", helpText: "Separate names with commas." },
    { name: "agenda", label: "Agenda", type: "textarea", placeholder: "What will you cover?" },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Notes and outcomes." },
  ];

  const columns: Column<MeetingWithCompany>[] = [
    {
      header: "Meeting",
      cell: (m) => (
        <div className="max-w-sm">
          <p className="font-medium">{m.title}</p>
          {m.company && (
            <p className="text-xs text-muted-foreground">{m.company.name}</p>
          )}
        </div>
      ),
    },
    {
      header: "When",
      cell: (m) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDateTime(m.starts_at)}
        </span>
      ),
    },
    {
      header: "Location",
      cell: (m) => (
        <span className="text-sm text-muted-foreground">
          {m.location ?? "—"}
        </span>
      ),
    },
    { header: "Status", cell: (m) => <MeetingStatusBadge value={m.status} /> },
  ];

  const toValues = (m: MeetingWithCompany) => ({
    title: m.title,
    starts_at: toLocalInput(m.starts_at),
    ends_at: toLocalInput(m.ends_at),
    status: m.status,
    location: m.location ?? "",
    company_id: m.company_id ?? "",
    attendees: (m.attendees ?? []).join(", "),
    agenda: m.agenda ?? "",
    notes: m.notes ?? "",
  });

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Your schedule, agendas, attendees, and notes in one place."
      />
      <ResourceManager<MeetingWithCompany>
        resourceName="Meeting"
        rows={meetings}
        fields={fields}
        columns={columns}
        getId={(m) => m.id}
        toValues={toValues}
        createAction={createMeeting}
        updateAction={updateMeeting}
        deleteAction={deleteMeeting}
        emptyIcon={CalendarClock}
        emptyTitle="No meetings scheduled"
        emptyDescription="Add a meeting to keep agendas and notes together."
      />
    </>
  );
}
