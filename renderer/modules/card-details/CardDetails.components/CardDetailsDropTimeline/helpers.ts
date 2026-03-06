import type { LeagueDateRangeDTO } from "~/main/modules/card-details/CardDetails.dto";

import { DEFAULT_LEAGUE_DURATION_MS } from "./constants";

// ─── Helpers ───────────────────────────────────────────────────────────────

export function leagueEndTime(lr: LeagueDateRangeDTO): number {
  if (lr.endDate) return new Date(lr.endDate).getTime();
  if (lr.startDate)
    return new Date(lr.startDate).getTime() + DEFAULT_LEAGUE_DURATION_MS;
  return Date.now();
}

export function leagueStartTime(lr: LeagueDateRangeDTO): number {
  if (lr.startDate) return new Date(lr.startDate).getTime();
  return 0;
}

export function formatAxisDate(timestamp: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
