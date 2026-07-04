import { createClient } from "@/lib/supabase/server";
import type { FieldOption } from "@/components/shared/resource-manager";

/** Company options for `<select>` fields, prefixed with a "none" choice. */
export async function getCompanyOptions(): Promise<FieldOption[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");
  return [
    { value: "", label: "— None —" },
    ...(data ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];
}

/** Aggregate counts + slices used by the dashboard. */
export async function getDashboardData() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    tasks,
    meetings,
    decisions,
    risks,
    opportunities,
    brief,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("meetings")
      .select("*, company:companies(*)")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase
      .from("decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("risks")
      .select("*")
      .eq("is_open", true)
      .order("created_at", { ascending: false }),
    supabase.from("opportunities").select("*"),
    supabase
      .from("daily_briefs")
      .select("*")
      .eq("brief_date", today)
      .maybeSingle(),
  ]);

  const openOpps = (opportunities.data ?? []).filter(
    (o) => o.stage !== "won" && o.stage !== "lost",
  );
  const pipelineValue = openOpps.reduce((sum, o) => sum + (o.value ?? 0), 0);

  return {
    tasks: tasks.data ?? [],
    meetings: meetings.data ?? [],
    decisions: decisions.data ?? [],
    risks: risks.data ?? [],
    openOpps,
    pipelineValue,
    brief: brief.data ?? null,
  };
}
