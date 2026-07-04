"use server";

import { revalidatePath } from "next/cache";
import {
  requireUser,
  guard,
  str,
  required,
  list,
  type Values,
} from "./helpers";
import type { MeetingStatus } from "@/lib/types/database";

function payload(v: Values) {
  return {
    title: required(v.title, "Title"),
    status: (v.status || "scheduled") as MeetingStatus,
    location: str(v.location),
    starts_at: required(v.starts_at, "Start time"),
    ends_at: str(v.ends_at),
    attendees: list(v.attendees),
    agenda: str(v.agenda),
    notes: str(v.notes),
    company_id: str(v.company_id),
  };
}

function revalidate() {
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

export async function createMeeting(values: Values) {
  return guard(async () => {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("meetings")
      .insert({ ...payload(values), user_id: user.id });
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function updateMeeting(id: string, values: Values) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("meetings")
      .update(payload(values))
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function deleteMeeting(id: string) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}
