"use server";

import { revalidatePath } from "next/cache";
import { requireUser, guard } from "./helpers";

/** Disconnect Google: remove the stored grant for the current user. */
export async function disconnectGoogle() {
  return guard(async () => {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("integration_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "google");
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
  });
}

/** Trigger a manual sync for one connector (delegates to the sync endpoint). */
export async function syncNow(connector: "gcal" | "gmail" | "gdrive") {
  return guard(async () => {
    const { supabase, user } = await requireUser();
    // Phase 0: record intent so the UI reflects a queued run. Phase 1 wires
    // this to the live connector (n8n calls the same /api/sync route).
    const { error } = await supabase.from("sync_state").upsert(
      { user_id: user.id, connector, status: "running" },
      { onConflict: "user_id,connector" },
    );
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
  });
}
