import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runConnector } from "@/lib/integrations/orchestrator";
import type { SyncConnector } from "@/lib/types/database";

export const dynamic = "force-dynamic";

const VALID: SyncConnector[] = ["gcal", "gmail", "gdrive"];

/**
 * POST /api/sync/:connector
 * Runs a connector sync for a user. Two auth paths:
 *   1. n8n / scheduler — `x-n8n-secret` header + `{ userId }` in the body.
 *   2. Interactive "Sync now" — the signed-in user's session (own data only).
 */
export async function POST(
  request: Request,
  { params }: { params: { connector: string } },
) {
  const connector = params.connector as SyncConnector;
  if (!VALID.includes(connector)) {
    return NextResponse.json(
      { ok: false, error: "Unknown connector." },
      { status: 404 },
    );
  }

  // ── Resolve the target user ──────────────────────────────────────
  let userId: string | undefined;
  const secret = request.headers.get("x-n8n-secret");
  const expected = process.env.N8N_WEBHOOK_SECRET;

  if (secret && expected && secret === expected) {
    const body = await request.json().catch(() => ({}));
    userId = body?.userId;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId is required for scheduled sync." },
        { status: 400 },
      );
    }
  } else {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated." },
        { status: 401 },
      );
    }
    userId = user.id;
  }

  // ── Run ──────────────────────────────────────────────────────────
  try {
    const result = await runConnector(connector, userId);
    return NextResponse.json({ ok: true, connector, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
