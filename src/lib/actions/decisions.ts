"use server";

import { revalidatePath } from "next/cache";
import {
  requireUser,
  guard,
  str,
  required,
  date,
  type Values,
} from "./helpers";
import type { DecisionStatus } from "@/lib/types/database";

function payload(v: Values) {
  return {
    title: required(v.title, "Title"),
    context: str(v.context),
    options: str(v.options),
    decision: str(v.decision),
    rationale: str(v.rationale),
    status: (v.status || "proposed") as DecisionStatus,
    decided_at: date(v.decided_at),
    company_id: str(v.company_id),
  };
}

function revalidate() {
  revalidatePath("/decisions");
  revalidatePath("/dashboard");
}

export async function createDecision(values: Values) {
  return guard(async () => {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("decisions")
      .insert({ ...payload(values), user_id: user.id });
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function updateDecision(id: string, values: Values) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("decisions")
      .update(payload(values))
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function deleteDecision(id: string) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("decisions").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}
