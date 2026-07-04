import { Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCompanyOptions } from "@/lib/data/queries";
import { PageHeader } from "@/components/shared/page-header";
import {
  ResourceManager,
  type Field,
  type Column,
} from "@/components/shared/resource-manager";
import { DecisionStatusBadge } from "@/components/shared/status-badges";
import { formatDate } from "@/lib/utils";
import {
  createDecision,
  updateDecision,
  deleteDecision,
} from "@/lib/actions/decisions";
import type { Decision } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const supabase = createClient();
  const [{ data: decisions }, companyOptions] = await Promise.all([
    supabase
      .from("decisions")
      .select("*")
      .order("created_at", { ascending: false }),
    getCompanyOptions(),
  ]);

  const fields: Field[] = [
    { name: "title", label: "Decision", type: "text", required: true, full: true, placeholder: "What is being decided?" },
    { name: "context", label: "Context", type: "textarea", placeholder: "Background and why it matters now." },
    { name: "options", label: "Options considered", type: "textarea", placeholder: "A) … · B) … · C) …" },
    {
      name: "status",
      label: "Status",
      type: "select",
      defaultValue: "proposed",
      options: [
        { value: "proposed", label: "Proposed" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
        { value: "deferred", label: "Deferred" },
      ],
    },
    { name: "decided_at", label: "Decided on", type: "date" },
    { name: "decision", label: "Decision made", type: "textarea", placeholder: "The chosen path." },
    { name: "rationale", label: "Rationale", type: "textarea", placeholder: "Why this was the right call." },
    { name: "company_id", label: "Company", type: "select", options: companyOptions },
  ];

  const columns: Column<Decision>[] = [
    {
      header: "Decision",
      cell: (d) => (
        <div className="max-w-md">
          <p className="font-medium">{d.title}</p>
          {d.decision && (
            <p className="truncate text-xs text-muted-foreground">
              → {d.decision}
            </p>
          )}
        </div>
      ),
    },
    { header: "Status", cell: (d) => <DecisionStatusBadge value={d.status} /> },
    {
      header: "Decided",
      cell: (d) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(d.decided_at)}
        </span>
      ),
    },
  ];

  const toValues = (d: Decision) => ({
    title: d.title,
    context: d.context ?? "",
    options: d.options ?? "",
    status: d.status,
    decided_at: d.decided_at ?? "",
    decision: d.decision ?? "",
    rationale: d.rationale ?? "",
    company_id: d.company_id ?? "",
  });

  return (
    <>
      <PageHeader
        title="Decisions"
        description="A durable log of the choices you make and why."
      />
      <ResourceManager<Decision>
        resourceName="Decision"
        rows={decisions ?? []}
        fields={fields}
        columns={columns}
        getId={(d) => d.id}
        toValues={toValues}
        createAction={createDecision}
        updateAction={updateDecision}
        deleteAction={deleteDecision}
        emptyIcon={Scale}
        emptyTitle="No decisions logged"
        emptyDescription="Capture your first decision to build an accountable record."
      />
    </>
  );
}
