import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { outlook, gmail } from "@/integrations";
import type { CalendarEvent } from "@/integrations/types";
import { formatTime } from "@/lib/format";

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    Promise.all([outlook.upcomingEvents(7), gmail.upcomingEvents(7)]).then(([a, b]) => {
      setEvents([...a, ...b].sort((x, y) => x.start.localeCompare(y.start)));
    });
  }, []);

  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const day = new Date(e.start).toDateString();
    (acc[day] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="mt-1 text-sm text-fg-muted">Outlook + Google Calendar, merged.</p>
      </header>

      <div className="space-y-4">
        {Object.entries(grouped).map(([day, items]) => (
          <Card key={day}>
            <CardHeader>
              <CardTitle>{day}</CardTitle>
              <span className="text-xs text-fg-muted">{items.length} events</span>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {items.map((e) => (
                  <li key={`${e.source}-${e.id}`} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-fg-muted">
                      {formatTime(new Date(e.start))} – {formatTime(new Date(e.end))}
                    </div>
                    <div className="text-sm font-medium">{e.title}</div>
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-fg-muted">{e.source}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
