// ── Number Formatting Helpers ──────────────────────────────────────────────────

/**
 * Format a chaos value for display.
 *
 * - Values ≥ 1,000,000 are shown as e.g. "3.45M c"
 * - Values ≥ 1,000 are shown with commas e.g. "34,500 c"
 * - Otherwise shown with fixed decimals e.g. "3.45 c"
 *
 * @param value   The chaos value to format
 * @param decimals Number of decimal places (default 0 for large values, 2 for small)
 */
export function formatChaos(value: number, decimals?: number): string {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    const d = decimals ?? 2;
    return `${(value / 1_000_000).toFixed(d)}M c`;
  }

  if (abs >= 1_000) {
    const d = decimals ?? 0;
    const formatted =
      d > 0
        ? value.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : Math.round(value).toLocaleString("en-US");
    return `${formatted} c`;
  }

  const d = decimals ?? 2;
  return `${value.toFixed(d)} c`;
}

/**
 * Convert a chaos value to divine equivalent and format it.
 *
 * - Values ≥ 1,000 divine are shown as e.g. "1.2k d"
 * - Otherwise shown with fixed decimals e.g. "6.9 d"
 *
 * @param chaosValue The value in chaos orbs
 * @param ratio      The chaos-to-divine ratio (chaos per divine)
 */
export function formatDivine(chaosValue: number, ratio: number): string {
  if (ratio <= 0) return "— d";

  const divineValue = chaosValue / ratio;
  const abs = Math.abs(divineValue);

  if (abs >= 1_000) {
    return `${(divineValue / 1_000).toFixed(1)}k d`;
  }

  if (abs >= 100) {
    return `${divineValue.toFixed(1)} d`;
  }

  return `${divineValue.toFixed(2)} d`;
}

/**
 * Format a probability (0–1) as a percentage string.
 *
 * - 0.00312 → "0.3120%"
 * - 0.632   → "63.20%"
 *
 * @param value    The probability value (0–1)
 * @param decimals Number of decimal places (default 2)
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a P&L value with sign prefix and comma separators.
 *
 * - Positive: "+2,273 c"
 * - Negative: "−450 c"  (uses proper minus sign U+2212)
 * - Zero:     "+0 c"
 *
 * @param value The P&L value in chaos
 */
export function formatPnL(value: number): string {
  const abs = Math.abs(value);
  let formatted: string;

  if (abs >= 1_000_000) {
    formatted = `${(abs / 1_000_000).toFixed(2)}M`;
  } else {
    formatted = Math.round(abs).toLocaleString("en-US");
  }

  if (value < 0) {
    return `\u2212${formatted} c`;
  }

  return `+${formatted} c`;
}

/**
 * Format a P&L value in divines with sign prefix.
 *
 * Converts a chaos P&L value to divines and formats with +/− sign.
 * - Positive: "+5.67 d"
 * - Negative: "−2.34 d"
 * - Zero:     "+0.00 d"
 *
 * @param chaosValue The P&L value in chaos
 * @param ratio      The chaos-to-divine ratio (chaos per divine)
 */
export function formatPnLDivine(chaosValue: number, ratio: number): string {
  if (ratio <= 0) return "— d";

  const divineValue = chaosValue / ratio;
  const abs = Math.abs(divineValue);
  let formatted: string;

  if (abs >= 1_000) {
    formatted = `${(abs / 1_000).toFixed(1)}k`;
  } else if (abs >= 100) {
    formatted = abs.toFixed(1);
  } else {
    formatted = abs.toFixed(2);
  }

  if (divineValue < 0) {
    return `\u2212${formatted} d`;
  }

  return `+${formatted} d`;
}
