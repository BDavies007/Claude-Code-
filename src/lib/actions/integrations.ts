"use server";

import { revalidatePath } from "next/cache";
import { requireUser, guard } from "./helpers";
import { runConnector, isConnectorLive } from "@/lib/integrations/orchestrator";
import type { SyncConnector } from "@/lib/types/database";

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

/** Run a connector sync now for the signed-in user (same code n8n calls). */
export async function syncNow(connector: SyncConnector) {
  return guard(async () => {
    const { user } = await requireUser();
    if (!isConnectorLive(connector)) {
      throw new Error("This connector isn't live yet.");
    }
    await runConnector(connector, user.id);
    revalidatePath("/settings");
    revalidatePath("/meetings");
    revalidatePath("/dashboard");
  });
}
