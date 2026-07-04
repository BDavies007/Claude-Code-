import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { generateAndSaveBrief } from "@/lib/ai/generate-brief";

export const dynamic = "force-dynamic";

/**
 * POST /api/daily-brief
 * Generates (or regenerates) today's executive brief for the signed-in user
 * using the configured AI provider, persists it, and returns the result.
 */
export async function POST() {
  try {
    const brief = await generateAndSaveBrief();
    revalidatePath("/daily-brief");
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, brief });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate brief.";
    const status = message === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
