"use server";

import { revalidatePath } from "next/cache";
import {
  requireUser,
  guard,
  str,
  required,
  num,
  int,
  date,
  type Values,
} from "./helpers";
import type { OpportunityStage } from "@/lib/types/database";

function payload(v: Values) {
  return {
    name: required(v.name, "Name"),
    stage: (v.stage || "prospect") as OpportunityStage,
    value: num(v.value),
    currency: str(v.currency) || "USD",
    probability: int(v.probability),
    close_date: date(v.close_date),
    owner: str(v.owner),
    notes: str(v.notes),
    company_id: str(v.company_id),
  };
}

function revalidate() {
  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
}

export async function createOpportunity(values: Values) {
  return guard(async () => {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("opportunities")
      .insert({ ...payload(values), user_id: user.id });
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function updateOpportunity(id: string, values: Values) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("opportunities")
      .update(payload(values))
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function deleteOpportunity(id: string) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("opportunities")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}
