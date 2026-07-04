import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Service-role Supabase client for background sync (no user session).
 *
 * Sync jobs run on behalf of a user without their cookies (e.g. when n8n calls
 * the sync endpoint), so they bypass RLS with the service role. Every query
 * MUST still filter by `user_id` explicitly — the service role is trusted code,
 * not a way around per-user isolation.
 *
 * Server-only. Never import this into a Client Component.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — required for background sync.",
    );
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
