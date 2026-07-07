import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";

const channels = [
  { id: "linkedin", label: "LinkedIn", reach: 12400, replies: 38, booked: 6 },
  { id: "x", label: "X / Twitter", reach: 4200, replies: 11, booked: 1 },
  { id: "ig", label: "Instagram", reach: 9100, replies: 7, booked: 0 },
  { id: "email", label: "Cold email", reach: 800, replies: 22, booked: 4 },
];

export function Leads() {
  const totalBooked = channels.reduce((s, c) => s + c.booked, 0);
  const totalReplies = channels.reduce((s, c) => s + c.replies, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Leads & Social</h1>
        <p className="mt-1 text-sm text-fg-muted">Outbound, social, and inbound lead flow.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Calls booked (week)" value={totalBooked} tone="success" />
        <Stat label="Replies (week)" value={totalReplies} />
        <Stat label="Channels active" value={channels.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel performance</CardTitle>
          <span className="text-xs text-fg-muted">Wire to LinkedIn / X / Buffer / Apollo later</span>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-border">
            {channels.map((c) => (
              <li key={c.id} className="grid grid-cols-4 gap-2 py-2.5 text-sm">
                <span className="font-medium">{c.label}</span>
                <span className="text-fg-muted">{c.reach.toLocaleString()} reach</span>
                <span className="text-fg-muted">{c.replies} replies</span>
                <span className="text-right font-semibold">{c.booked} booked</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
