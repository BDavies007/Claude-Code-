import { CheckSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCompanyOptions } from "@/lib/data/queries";
import { PageHeader } from "@/components/shared/page-header";
import {
  ResourceManager,
  type Field,
  type Column,
} from "@/components/shared/resource-manager";
import { TaskStatusBadge, PriorityBadge } from "@/components/shared/status-badges";
import { formatDate } from "@/lib/utils";
import {
  createTask,
  updateTask,
  deleteTask,
} from "@/lib/actions/tasks";
import type { Task } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = createClient();
  const [{ data: tasks }, companyOptions] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .order("status")
      .order("due_date", { ascending: true, nullsFirst: false }),
    getCompanyOptions(),
  ]);

  const fields: Field[] = [
    { name: "title", label: "Title", type: "text", required: true, full: true, placeholder: "What needs doing?" },
    { name: "description", label: "Description", type: "textarea", placeholder: "Details, context, links…" },
    {
      name: "status",
      label: "Status",
      type: "select",
      defaultValue: "todo",
      options: [
        { value: "todo", label: "To do" },
        { value: "in_progress", label: "In progress" },
        { value: "blocked", label: "Blocked" },
        { value: "done", label: "Done" },
      ],
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      defaultValue: "medium",
      options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "critical", label: "Critical" },
      ],
    },
    { name: "due_date", label: "Due date", type: "date" },
    { name: "assignee", label: "Assignee", type: "text", placeholder: "Owner name" },
    { name: "company_id", label: "Company", type: "select", options: companyOptions },
  ];

  const columns: Column<Task>[] = [
    {
      header: "Task",
      cell: (t) => (
        <div className="max-w-md">
          <p className="font-medium">{t.title}</p>
          {t.description && (
            <p className="truncate text-xs text-muted-foreground">
              {t.description}
            </p>
          )}
        </div>
      ),
    },
    { header: "Status", cell: (t) => <TaskStatusBadge value={t.status} /> },
    { header: "Priority", cell: (t) => <PriorityBadge value={t.priority} /> },
    {
      header: "Due",
      cell: (t) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(t.due_date)}
        </span>
      ),
    },
    {
      header: "Assignee",
      cell: (t) => (
        <span className="text-sm text-muted-foreground">
          {t.assignee ?? "—"}
        </span>
      ),
    },
  ];

  const toValues = (t: Task) => ({
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    priority: t.priority,
    due_date: t.due_date ?? "",
    assignee: t.assignee ?? "",
    company_id: t.company_id ?? "",
  });

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Everything that needs doing — prioritised and owned."
      />
      <ResourceManager<Task>
        resourceName="Task"
        rows={tasks ?? []}
        fields={fields}
        columns={columns}
        getId={(t) => t.id}
        toValues={toValues}
        createAction={createTask}
        updateAction={updateTask}
        deleteAction={deleteTask}
        emptyIcon={CheckSquare}
        emptyTitle="No tasks yet"
        emptyDescription="Add your first task to start tracking execution."
      />
    </>
  );
}
