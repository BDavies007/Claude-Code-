import { createClient } from "@/lib/supabase/server";
import { generateDailyBrief } from "@/lib/ai";
import type { BriefResult } from "@/lib/ai/types";

/**
 * Gather today's context for the signed-in user, generate a brief via the
 * configured AI provider (or the local fallback), and persist it as today's
 * `daily_briefs` row. Returns the saved brief plus the provider used.
 */
export async function generateAndSaveBrief(): Promise<
  BriefResult & { brief_date: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const today = new Date().toISOString().slice(0, 10);

  const [profile, tasks, meetings, risks, opportunities, decisions] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, company_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("tasks").select("*").neq("status", "done"),
      supabase
        .from("meetings")
        .select("*")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true }),
      supabase.from("risks").select("*").eq("is_open", true),
      supabase.from("opportunities").select("*"),
      supabase
        .from("decisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const result = await generateDailyBrief({
    fullName: profile.data?.full_name ?? "there",
    companyName: profile.data?.company_name ?? "your company",
    date: today,
    tasks: tasks.data ?? [],
    meetings: meetings.data ?? [],
    risks: risks.data ?? [],
    opportunities: opportunities.data ?? [],
    decisions: decisions.data ?? [],
  });

  const { error } = await supabase.from("daily_briefs").upsert(
    {
      user_id: user.id,
      brief_date: today,
      headline: result.headline,
      summary: result.summary,
      highlights: result.highlights,
    },
    { onConflict: "user_id,brief_date" },
  );
  if (error) throw new Error(error.message);

  return { ...result, brief_date: today };
}
