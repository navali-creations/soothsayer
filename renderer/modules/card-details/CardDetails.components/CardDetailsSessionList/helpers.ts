/**
 * Format an ISO date string as a short readable date.
 * e.g. "Jan 15, 2026"
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format duration in minutes as a human-readable string.
 * e.g. "1h 23m" or "45m"
 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}
