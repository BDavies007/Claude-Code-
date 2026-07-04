"use server";

import { revalidatePath } from "next/cache";
import { requireUser, guard, str, required, type Values } from "./helpers";

function payload(v: Values) {
  return {
    name: required(v.name, "Name"),
    industry: str(v.industry),
    website: str(v.website),
    location: str(v.location),
    size: str(v.size),
    description: str(v.description),
  };
}

function revalidate() {
  revalidatePath("/companies");
  // Companies are referenced elsewhere as select options.
  revalidatePath("/contacts");
  revalidatePath("/meetings");
  revalidatePath("/opportunities");
}

export async function createCompany(values: Values) {
  return guard(async () => {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("companies")
      .insert({ ...payload(values), user_id: user.id });
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function updateCompany(id: string, values: Values) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("companies")
      .update(payload(values))
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function deleteCompany(id: string) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}
