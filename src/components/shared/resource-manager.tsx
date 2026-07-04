"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Trash2, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "./empty-state";
import { cn } from "@/lib/utils";

// ── Config types ────────────────────────────────────────────────────
export interface FieldOption {
  value: string;
  label: string;
}

export interface Field {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "email"
    | "number"
    | "date"
    | "datetime"
    | "url"
    | "tel"
    | "select";
  placeholder?: string;
  required?: boolean;
  options?: FieldOption[];
  /** Span the full width of the two-column form grid. */
  full?: boolean;
  /** Default value used when creating a new record. */
  defaultValue?: string;
  helpText?: string;
}

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

export type ActionResult = { error?: string } | void;
type Values = Record<string, string>;

interface ResourceManagerProps<T> {
  /** Singular noun, e.g. "Task". Used in buttons and the dialog title. */
  resourceName: string;
  rows: T[];
  fields: Field[];
  columns: Column<T>[];
  getId: (row: T) => string;
  /** Map a row to its editable form values (for the edit dialog). */
  toValues: (row: T) => Values;
  createAction: (values: Values) => Promise<ActionResult>;
  updateAction: (id: string, values: Values) => Promise<ActionResult>;
  deleteAction: (id: string) => Promise<ActionResult>;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
}

export function ResourceManager<T>({
  resourceName,
  rows,
  fields,
  columns,
  getId,
  toValues,
  createAction,
  updateAction,
  deleteAction,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: ResourceManagerProps<T>) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<T | null>(null);
  const [values, setValues] = React.useState<Values>({});
  const [pending, setPending] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function openCreate() {
    const initial: Values = {};
    for (const f of fields) initial[f.name] = f.defaultValue ?? "";
    setValues(initial);
    setEditing(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(row: T) {
    setValues(toValues(row));
    setEditing(row);
    setError(null);
    setDialogOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = editing
      ? await updateAction(getId(editing), values)
      : await createAction(values);
    setPending(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setDialogOpen(false);
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!window.confirm(`Delete this ${resourceName.toLowerCase()}? This cannot be undone.`))
      return;
    setDeletingId(id);
    const result = await deleteAction(id);
    setDeletingId(null);
    if (result && "error" in result && result.error) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New {resourceName}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New {resourceName}
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.header} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
                <TableHead className="w-10 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const id = getId(row);
                return (
                  <TableRow key={id}>
                    {columns.map((col) => (
                      <TableCell key={col.header} className={col.className}>
                        {col.cell(row)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === id}
                          >
                            {deletingId === id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onSelect={() => onDelete(id)}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${resourceName}` : `New ${resourceName}`}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `Update the details for this ${resourceName.toLowerCase()}.`
                : `Add a new ${resourceName.toLowerCase()} to your command centre.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className={cn(
                    "space-y-1.5",
                    (field.full || field.type === "textarea") && "sm:col-span-2",
                  )}
                >
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && (
                      <span className="ml-0.5 text-electric-400">*</span>
                    )}
                  </Label>
                  <FieldInput
                    field={field}
                    value={values[field.name] ?? ""}
                    onChange={(v) =>
                      setValues((prev) => ({ ...prev, [field.name]: v }))
                    }
                  />
                  {field.helpText && (
                    <p className="text-xs text-muted-foreground">
                      {field.helpText}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : `Create ${resourceName}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <Textarea
        id={field.name}
        value={value}
        placeholder={field.placeholder}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "select") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={field.name}>
          <SelectValue placeholder={field.placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  const inputType = field.type === "datetime" ? "datetime-local" : field.type;
  return (
    <Input
      id={field.name}
      type={inputType}
      value={value}
      placeholder={field.placeholder}
      required={field.required}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
