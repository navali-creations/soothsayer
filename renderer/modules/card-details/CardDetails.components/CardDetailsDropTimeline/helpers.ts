import type { LeagueDateRangeDTO } from "~/main/modules/card-details/CardDetails.dto";

// ─── Helpers ───────────────────────────────────────────────────────────────

const DEFAULT_LEAGUE_DURATION_MS = 4 * 30 * 24 * 60 * 60 * 1000;
const LEAGUE_HANDOFF_BUFFER_MS = 3 * 24 * 60 * 60 * 1000;

export function leagueEndTime(
  lr: LeagueDateRangeDTO,
  allRanges: LeagueDateRangeDTO[] = [],
): number {
  if (lr.endDate) {
    const end = new Date(lr.endDate).getTime();
    if (Number.isFinite(end)) return end;
  }

  if (lr.startDate) {
    const currentStart = new Date(lr.startDate).getTime();
    if (Number.isFinite(currentStart)) {
      let nextStart: number | undefined;
      for (const range of allRanges) {
        if (!range.startDate) continue;
        const candidate = new Date(range.startDate).getTime();
        if (!Number.isFinite(candidate) || candidate <= currentStart) continue;
        nextStart =
          nextStart === undefined ? candidate : Math.min(nextStart, candidate);
      }
      if (nextStart !== undefined) {
        return Math.max(currentStart, nextStart - LEAGUE_HANDOFF_BUFFER_MS);
      }

      const approxEnd = currentStart + DEFAULT_LEAGUE_DURATION_MS;
      return Math.min(Date.now(), approxEnd);
    }
  }

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
