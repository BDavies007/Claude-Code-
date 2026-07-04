import { Building2, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import {
  ResourceManager,
  type Field,
  type Column,
} from "@/components/shared/resource-manager";
import {
  createCompany,
  updateCompany,
  deleteCompany,
} from "@/lib/actions/companies";
import type { Company } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const supabase = createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .order("name");

  const fields: Field[] = [
    { name: "name", label: "Company name", type: "text", required: true, placeholder: "Acme Corp" },
    { name: "industry", label: "Industry", type: "text", placeholder: "Clean Technology" },
    { name: "website", label: "Website", type: "url", placeholder: "https://…" },
    { name: "location", label: "Location", type: "text", placeholder: "City, Country" },
    { name: "size", label: "Size", type: "text", placeholder: "e.g. 120 employees" },
    { name: "description", label: "Description", type: "textarea", placeholder: "What they do and why they matter." },
  ];

  const columns: Column<Company>[] = [
    {
      header: "Company",
      cell: (c) => (
        <div>
          <p className="font-medium">{c.name}</p>
          {c.industry && (
            <p className="text-xs text-muted-foreground">{c.industry}</p>
          )}
        </div>
      ),
    },
    {
      header: "Location",
      cell: (c) => (
        <span className="text-sm text-muted-foreground">
          {c.location ?? "—"}
        </span>
      ),
    },
    {
      header: "Website",
      cell: (c) =>
        c.website ? (
          <a
            href={c.website}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-electric-400 hover:text-electric-500"
          >
            <Globe className="h-3.5 w-3.5" /> Visit
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
  ];

  const toValues = (c: Company) => ({
    name: c.name,
    industry: c.industry ?? "",
    website: c.website ?? "",
    location: c.location ?? "",
    size: c.size ?? "",
    description: c.description ?? "",
  });

  return (
    <>
      <PageHeader
        title="Companies"
        description="Accounts, partners, and investors you track."
      />
      <ResourceManager<Company>
        resourceName="Company"
        rows={companies ?? []}
        fields={fields}
        columns={columns}
        getId={(c) => c.id}
        toValues={toValues}
        createAction={createCompany}
        updateAction={updateCompany}
        deleteAction={deleteCompany}
        emptyIcon={Building2}
        emptyTitle="No companies yet"
        emptyDescription="Add the organisations you do business with."
      />
    </>
  );
}
