import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { currency } from "@/lib/format";
import type { CrmClient } from "@/types/atlas";

const STAGES = ["Lead", "Qualified", "Proposal", "Onboarding", "Active", "Lost"];

export function CRM() {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const load = () => window.atlas.db.crm.list().then(setClients);

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Clients & CRM</h1>
        <p className="mt-1 text-sm text-fg-muted">Pipeline, accounts, and ownership.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add client</CardTitle>
        </CardHeader>
        <CardBody>
          <AddClientForm onAdded={load} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <span className="text-xs text-fg-muted">{clients.length} total</span>
        </CardHeader>
        <CardBody>
          {clients.length === 0 ? (
            <p className="text-sm text-fg-muted">No clients yet — add one above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="py-2">Client</th>
                  <th>Stage</th>
                  <th>Annual value</th>
                  <th>Owner</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-bg-subtle">
                    <td className="py-2.5 font-medium">{c.name}</td>
                    <td>
                      <span className="rounded-md border border-border bg-bg px-2 py-0.5 text-xs">
                        {c.stage}
                      </span>
                    </td>
                    <td>{currency(c.value)}</td>
                    <td className="text-fg-muted">{c.owner}</td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await window.atlas.db.crm.delete(c.id);
                          load();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function AddClientForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [stage, setStage] = useState(STAGES[0]);
  const [value, setValue] = useState("");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setBusy(true);
    await window.atlas.db.crm.add({
      id: crypto.randomUUID(),
      name,
      stage,
      value: Number(value) || 0,
      owner,
    });
    setName("");
    setValue("");
    setOwner("");
    setBusy(false);
    onAdded();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 md:grid-cols-4">
      <input
        type="text"
        placeholder="Client name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      >
        {STAGES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <input
        type="number"
        placeholder="Annual value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <input
        type="text"
        placeholder="Owner"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <div className="md:col-span-4">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Add client"}
        </Button>
      </div>
    </form>
  );
}
