import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

type Status = "On track" | "At risk" | "Blocked" | "Done";

const projects: { id: string; name: string; status: Status; due: string; owner: string }[] = [
  { id: "p1", name: "Northwind portal v2", status: "On track", due: "2026-05-22", owner: "Brad" },
  { id: "p2", name: "AcmeCorp pitch", status: "At risk", due: "2026-05-14", owner: "Brad" },
  { id: "p3", name: "Internal automation: brief generator", status: "On track", due: "2026-05-30", owner: "Brad" },
  { id: "p4", name: "Q2 board pack", status: "Blocked", due: "2026-05-12", owner: "Brad" },
];

const tone: Record<Status, string> = {
  "On track": "bg-success/15 text-success",
  "At risk": "bg-warn/15 text-warn",
  Blocked: "bg-danger/15 text-danger",
  Done: "bg-bg-subtle text-fg-muted",
};

export function Projects() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-fg-muted">Active workstreams across the business.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Active projects</CardTitle>
          <span className="text-xs text-fg-muted">{projects.length} total</span>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-border">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-fg-muted">Due {p.due} · {p.owner}</div>
                </div>
                <span className={"rounded-md px-2 py-1 text-xs font-medium " + tone[p.status]}>{p.status}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
