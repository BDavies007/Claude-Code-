import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCompanyOptions } from "@/lib/data/queries";
import { PageHeader } from "@/components/shared/page-header";
import {
  ResourceManager,
  type Field,
  type Column,
} from "@/components/shared/resource-manager";
import { StageBadge } from "@/components/shared/status-badges";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} from "@/lib/actions/opportunities";
import { Card, CardContent } from "@/components/ui/card";
import type { OpportunityWithCompany } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const supabase = createClient();
  const [{ data }, companyOptions] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*, company:companies(*)")
      .order("close_date", { ascending: true, nullsFirst: false }),
    getCompanyOptions(),
  ]);

  const rows = (data ?? []) as unknown as OpportunityWithCompany[];
  const open = rows.filter((o) => o.stage !== "won" && o.stage !== "lost");
  const pipeline = open.reduce((s, o) => s + (o.value ?? 0), 0);
  const weighted = open.reduce(
    (s, o) => s + ((o.value ?? 0) * (o.probability ?? 0)) / 100,
    0,
  );
  const won = rows.filter((o) => o.stage === "won").reduce((s, o) => s + (o.value ?? 0), 0);

  const fields: Field[] = [
    { name: "name", label: "Opportunity", type: "text", required: true, full: true, placeholder: "Deal name" },
    { name: "company_id", label: "Company", type: "select", options: companyOptions },
    {
      name: "stage",
      label: "Stage",
      type: "select",
      defaultValue: "prospect",
      options: [
        { value: "prospect", label: "Prospect" },
        { value: "qualified", label: "Qualified" },
        { value: "proposal", label: "Proposal" },
        { value: "negotiation", label: "Negotiation" },
        { value: "won", label: "Won" },
        { value: "lost", label: "Lost" },
      ],
    },
    { name: "value", label: "Value", type: "number", placeholder: "250000" },
    { name: "currency", label: "Currency", type: "text", defaultValue: "USD", placeholder: "USD" },
    { name: "probability", label: "Probability (%)", type: "number", placeholder: "0–100" },
    { name: "close_date", label: "Expected close", type: "date" },
    { name: "owner", label: "Owner", type: "text", placeholder: "Deal owner" },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Context, next steps…" },
  ];

  const columns: Column<OpportunityWithCompany>[] = [
    {
      header: "Opportunity",
      cell: (o) => (
        <div className="max-w-xs">
          <p className="font-medium">{o.name}</p>
          {o.company && (
            <p className="text-xs text-muted-foreground">{o.company.name}</p>
          )}
        </div>
      ),
    },
    { header: "Stage", cell: (o) => <StageBadge value={o.stage} /> },
    {
      header: "Value",
      cell: (o) => (
        <span className="whitespace-nowrap text-sm font-medium">
          {formatCurrency(o.value, o.currency)}
        </span>
      ),
    },
    {
      header: "Prob.",
      cell: (o) => (
        <span className="text-sm text-muted-foreground">
          {o.probability != null ? `${o.probability}%` : "—"}
        </span>
      ),
    },
    {
      header: "Close",
      cell: (o) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDate(o.close_date)}
        </span>
      ),
    },
  ];

  const toValues = (o: OpportunityWithCompany) => ({
    name: o.name,
    company_id: o.company_id ?? "",
    stage: o.stage,
    value: o.value != null ? String(o.value) : "",
    currency: o.currency,
    probability: o.probability != null ? String(o.probability) : "",
    close_date: o.close_date ?? "",
    owner: o.owner ?? "",
    notes: o.notes ?? "",
  });

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Your pipeline — value, stage, and probability."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Open pipeline" value={formatCurrency(pipeline)} />
        <Stat label="Weighted pipeline" value={formatCurrency(weighted)} />
        <Stat label="Closed won" value={formatCurrency(won)} />
      </div>

      <ResourceManager<OpportunityWithCompany>
        resourceName="Opportunity"
        rows={rows}
        fields={fields}
        columns={columns}
        getId={(o) => o.id}
        toValues={toValues}
        createAction={createOpportunity}
        updateAction={updateOpportunity}
        deleteAction={deleteOpportunity}
        emptyIcon={Target}
        emptyTitle="No opportunities yet"
        emptyDescription="Add a deal to start building your pipeline view."
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
