import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { currency } from "@/lib/format";

const clients = [
  { id: "c1", name: "Northwind Group", stage: "Active", value: 96000, owner: "Brad" },
  { id: "c2", name: "AcmeCorp", stage: "Proposal", value: 45000, owner: "Brad" },
  { id: "c3", name: "Stellar Labs", stage: "Onboarding", value: 22000, owner: "Brad" },
  { id: "c4", name: "Marlow & Co", stage: "Lead", value: 0, owner: "Brad" },
];

export function CRM() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Clients & CRM</h1>
        <p className="mt-1 text-sm text-fg-muted">Pipeline, accounts, and ownership.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <span className="text-xs text-fg-muted">{clients.length} total</span>
        </CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="py-2">Client</th>
                <th>Stage</th>
                <th>Annual value</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-bg-subtle">
                  <td className="py-2.5 font-medium">{c.name}</td>
                  <td>
                    <span className="rounded-md border border-border bg-bg px-2 py-0.5 text-xs">{c.stage}</span>
                  </td>
                  <td>{currency(c.value)}</td>
                  <td className="text-fg-muted">{c.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
