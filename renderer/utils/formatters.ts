export interface FormatBytesOptions {
  compact?: boolean;
}

export interface FormatDurationMsOptions {
  includeSecondsWithHours?: boolean;
}

export function formatNumber(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : value.toFixed(0);
}

export function formatPercent(
  value: number | null,
  decimals: number = 1,
): string {
  return value === null || !Number.isFinite(value)
    ? "n/a"
    : `${value.toFixed(decimals)}%`;
}

export function formatWholePercent(value: number | null): string {
  return formatPercent(value, 0);
}

export function formatBytes(
  bytes: number,
  { compact = false }: FormatBytesOptions = {},
): string {
  if (!Number.isFinite(bytes)) return "n/a";
  if (bytes === 0) return compact ? "0B" : "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.max(
    0,
    Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))),
  );
  const normalized = bytes / 1024 ** unitIndex;
  const decimals = compact
    ? resolveCompactByteDecimals(normalized, unitIndex)
    : normalized < 10
      ? 2
      : 1;
  const separator = compact ? "" : " ";

  return `${normalized.toFixed(decimals)}${separator}${units[unitIndex]}`;
}

export function formatNullableBytes(
  value: number | null,
  options?: FormatBytesOptions,
): string {
  return value === null || !Number.isFinite(value)
    ? "n/a"
    : formatBytes(value, options);
}

export function formatCompactBytes(value: number | null): string {
  return formatNullableBytes(value, { compact: true });
}

export function formatShortDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatDurationMs(
  ms: number,
  { includeSecondsWithHours = true }: FormatDurationMsOptions = {},
): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    const base = `${hours}h ${String(minutes).padStart(2, "0")}m`;
    return includeSecondsWithHours
      ? `${base} ${String(seconds).padStart(2, "0")}s`
      : base;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function resolveCompactByteDecimals(
  normalized: number,
  unitIndex: number,
): number {
  if (normalized < 10 && unitIndex > 0) return 2;
  if (normalized < 100) return 1;
  return 0;
}
