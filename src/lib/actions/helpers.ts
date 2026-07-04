import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };
export type Values = Record<string, string>;

/** Resolve the Supabase client and require an authenticated user. */
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** Trim a form value; empty strings become null (so DB columns stay clean). */
export function str(v: string | undefined | null): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

/** Required trimmed string — throws a friendly error if missing. */
export function required(v: string | undefined | null, label: string): string {
  const t = str(v);
  if (!t) throw new Error(`${label} is required.`);
  return t;
}

/** Parse an optional number; blank → null. */
export function num(v: string | undefined | null): number | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Parse an optional integer; blank → null. */
export function int(v: string | undefined | null): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n);
}

/** Optional date (YYYY-MM-DD) — blank → null. */
export function date(v: string | undefined | null): string | null {
  return str(v);
}

/** Split a comma / newline separated field into a trimmed array. */
export function list(v: string | undefined | null): string[] {
  return (v ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Wrap a mutation so thrown errors become `{ error }` for the client. */
export async function guard(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
