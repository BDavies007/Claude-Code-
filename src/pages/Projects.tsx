import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { ProjectRow } from "@/types/atlas";

type Status = ProjectRow["status"];
const STATUSES: Status[] = ["On track", "At risk", "Blocked", "Done"];

const tone: Record<Status, string> = {
  "On track": "bg-success/15 text-success",
  "At risk": "bg-warn/15 text-warn",
  Blocked: "bg-danger/15 text-danger",
  Done: "bg-bg-subtle text-fg-muted",
};

export function Projects() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const load = () => window.atlas.db.projects.list().then(setProjects);

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-fg-muted">Active workstreams across the business.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add project</CardTitle>
        </CardHeader>
        <CardBody>
          <AddProjectForm onAdded={load} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <span className="text-xs text-fg-muted">{projects.length} total</span>
        </CardHeader>
        <CardBody>
          {projects.length === 0 ? (
            <p className="text-sm text-fg-muted">No projects yet — add one above.</p>
          ) : (
            <ul className="divide-y divide-border">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-fg-muted">
                      Due {p.due} · {p.owner}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={"rounded-md px-2 py-1 text-xs font-medium " + tone[p.status]}>
                      {p.status}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await window.atlas.db.projects.delete(p.id);
                        load();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function AddProjectForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [due, setDue] = useState(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<Status>("On track");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setBusy(true);
    await window.atlas.db.projects.add({
      id: crypto.randomUUID(),
      name,
      due,
      owner,
      status,
    });
    setName("");
    setOwner("");
    setBusy(false);
    onAdded();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 md:grid-cols-4">
      <input
        type="text"
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <input
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <input
        type="text"
        placeholder="Owner"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as Status)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      >
        {STATUSES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <div className="md:col-span-4">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Add project"}
        </Button>
      </div>
    </form>
  );
}
