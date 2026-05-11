import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { outlook, gmail } from "@/integrations";
import type { InboxMessage } from "@/integrations/types";

export function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);

  useEffect(() => {
    Promise.all([outlook.recentMessages(20), gmail.recentMessages(20)]).then(([a, b]) => {
      setMessages([...a, ...b].sort((x, y) => y.receivedAt.localeCompare(x.receivedAt)));
    });
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-fg-muted">Unified Outlook + Gmail, priority-ranked.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Recent</CardTitle>
          <span className="text-xs text-fg-muted">{messages.length} messages</span>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-border">
            {messages.map((m) => (
              <li key={`${m.source}-${m.id}`} className="flex items-start gap-3 py-3">
                <span
                  className={
                    "mt-1 h-2 w-2 shrink-0 rounded-full " +
                    (m.priority === "high" ? "bg-danger" : m.unread ? "bg-brand" : "bg-border")
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{m.from}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-fg-muted">
                      {m.source}
                    </span>
                  </div>
                  <div className="truncate text-sm">{m.subject}</div>
                  <div className="line-clamp-1 text-xs text-fg-muted">{m.snippet}</div>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
