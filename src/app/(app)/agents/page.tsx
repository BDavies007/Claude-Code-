import { Bot } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_AGENTS, ACCENT_CLASSES, type AgentDef } from "@/lib/data/agents";
import { timeAgo, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AgentView = AgentDef & { last_active?: string | null };

export default async function AgentsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("ai_agents")
    .select("*")
    .order("created_at", { ascending: true });

  // Fall back to the default roster for brand-new accounts.
  const agents: AgentView[] =
    data && data.length > 0
      ? data.map((a) => ({
          name: a.name,
          role: a.role,
          description: a.description ?? "",
          accent: a.accent ?? "electric",
          status: a.status,
          last_active: a.last_active,
        }))
      : DEFAULT_AGENTS;

  return (
    <>
      <PageHeader
        title="AI Agents"
        description="Your AI staff — each specialised, always on, working alongside you."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const accent =
            ACCENT_CLASSES[agent.accent] ?? ACCENT_CLASSES.electric;
          const active = agent.status === "active";
          return (
            <Card key={agent.name} className="transition-colors hover:border-electric-500/40">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold ring-1",
                      accent,
                    )}
                  >
                    {agent.name[0]}
                  </div>
                  <Badge variant={active ? "success" : "neutral"}>
                    <span
                      className={cn(
                        "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                        active ? "bg-emerald-400" : "bg-muted-foreground",
                      )}
                    />
                    {active ? "Active" : "Idle"}
                  </Badge>
                </div>

                <h3 className="mt-4 text-base font-semibold">{agent.name}</h3>
                <p className="text-sm text-electric-400">{agent.role}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {agent.description}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5" /> AI agent
                  </span>
                  {agent.last_active && (
                    <span>Last active {timeAgo(agent.last_active)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Agents are represented as first-class actors. Live task execution ships
        with the next integration wave (Gmail, Calendar, Drive, and n8n).
      </p>
    </>
  );
}
