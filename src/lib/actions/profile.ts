"use server";

import { revalidatePath } from "next/cache";
import { requireUser, guard, str, type Values } from "./helpers";

export async function updateProfile(values: Values) {
  return guard(async () => {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: str(values.full_name),
        title: str(values.title),
        company_name: str(values.company_name),
      })
      .eq("id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
  });
}
