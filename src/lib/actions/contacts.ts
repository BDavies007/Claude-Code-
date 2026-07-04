"use server";

import { revalidatePath } from "next/cache";
import { requireUser, guard, str, required, type Values } from "./helpers";

function payload(v: Values) {
  return {
    full_name: required(v.full_name, "Name"),
    role: str(v.role),
    email: str(v.email),
    phone: str(v.phone),
    linkedin_url: str(v.linkedin_url),
    notes: str(v.notes),
    company_id: str(v.company_id),
  };
}

export async function createContact(values: Values) {
  return guard(async () => {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("contacts")
      .insert({ ...payload(values), user_id: user.id });
    if (error) throw new Error(error.message);
    revalidatePath("/contacts");
  });
}

export async function updateContact(id: string, values: Values) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("contacts")
      .update(payload(values))
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/contacts");
  });
}

export async function deleteContact(id: string) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/contacts");
  });
}
