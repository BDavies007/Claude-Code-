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
import type { TaskStatus, TaskPriority } from "@/lib/types/database";

function payload(v: Values) {
  return {
    title: required(v.title, "Title"),
    description: str(v.description),
    status: (v.status || "todo") as TaskStatus,
    priority: (v.priority || "medium") as TaskPriority,
    due_date: date(v.due_date),
    assignee: str(v.assignee),
    company_id: str(v.company_id),
  };
}

function revalidate() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function createTask(values: Values) {
  return guard(async () => {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("tasks")
      .insert({ ...payload(values), user_id: user.id });
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function updateTask(id: string, values: Values) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("tasks")
      .update(payload(values))
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}

export async function deleteTask(id: string) {
  return guard(async () => {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
  });
}
