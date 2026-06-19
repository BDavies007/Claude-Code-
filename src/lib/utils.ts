import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as GBP currency with optional compact notation. */
export function formatCurrency(
  value: number,
  opts: { compact?: boolean; decimals?: number; currency?: string } = {}
): string {
  const { compact = false, decimals = 0, currency = "GBP" } = opts;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

/** Format a number as a percentage. Input expressed as a fraction (0.12 -> 12%). */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format a plain number with thousands separators. */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
