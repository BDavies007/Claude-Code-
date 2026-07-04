import { Users, Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCompanyOptions } from "@/lib/data/queries";
import { PageHeader } from "@/components/shared/page-header";
import {
  ResourceManager,
  type Field,
  type Column,
} from "@/components/shared/resource-manager";
import {
  createContact,
  updateContact,
  deleteContact,
} from "@/lib/actions/contacts";
import type { ContactWithCompany } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const supabase = createClient();
  const [{ data }, companyOptions] = await Promise.all([
    supabase
      .from("contacts")
      .select("*, company:companies(*)")
      .order("full_name"),
    getCompanyOptions(),
  ]);
  // Many-to-one embeds return a single object at runtime.
  const contacts = (data ?? []) as unknown as ContactWithCompany[];

  const fields: Field[] = [
    { name: "full_name", label: "Full name", type: "text", required: true, placeholder: "Jane Doe" },
    { name: "role", label: "Role / title", type: "text", placeholder: "VP Business Development" },
    { name: "company_id", label: "Company", type: "select", options: companyOptions },
    { name: "email", label: "Email", type: "email", placeholder: "jane@company.com" },
    { name: "phone", label: "Phone", type: "tel", placeholder: "+1 555 000 0000" },
    { name: "linkedin_url", label: "LinkedIn", type: "url", placeholder: "https://linkedin.com/in/…" },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Relationship context, preferences…" },
  ];

  const columns: Column<ContactWithCompany>[] = [
    {
      header: "Name",
      cell: (c) => (
        <div>
          <p className="font-medium">{c.full_name}</p>
          {c.role && (
            <p className="text-xs text-muted-foreground">{c.role}</p>
          )}
        </div>
      ),
    },
    {
      header: "Company",
      cell: (c) => (
        <span className="text-sm text-muted-foreground">
          {c.company?.name ?? "—"}
        </span>
      ),
    },
    {
      header: "Contact",
      cell: (c) => (
        <div className="space-y-0.5 text-sm text-muted-foreground">
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" /> {c.email}
            </a>
          )}
          {c.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {c.phone}
            </span>
          )}
          {!c.email && !c.phone && "—"}
        </div>
      ),
    },
  ];

  const toValues = (c: ContactWithCompany) => ({
    full_name: c.full_name,
    role: c.role ?? "",
    company_id: c.company_id ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    linkedin_url: c.linkedin_url ?? "",
    notes: c.notes ?? "",
  });

  return (
    <>
      <PageHeader
        title="Contacts"
        description="The people in your orbit — investors, partners, and team."
      />
      <ResourceManager<ContactWithCompany>
        resourceName="Contact"
        rows={contacts}
        fields={fields}
        columns={columns}
        getId={(c) => c.id}
        toValues={toValues}
        createAction={createContact}
        updateAction={updateContact}
        deleteAction={deleteContact}
        emptyIcon={Users}
        emptyTitle="No contacts yet"
        emptyDescription="Add the people you work with most."
      />
    </>
  );
}
