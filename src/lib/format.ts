// Lightweight formatting helpers used across the dashboard.

export function formatCurrency(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMillions(value: number): string {
  return `£${value.toFixed(1)}m`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(2)}x`;
}
