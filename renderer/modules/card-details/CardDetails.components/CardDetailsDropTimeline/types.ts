// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  /** Unix timestamp in ms — the X axis value */
  time: number;
  /** Aggregated drop count for this day (sum of all sessions on same day) */
  count: number;
  /** Cumulative total drops (area/line, left axis) */
  cumulativeCount: number;
  /** Total decks opened across all sessions on this day */
  totalDecksOpened: number;
  /** League name */
  league: string;
  /** ISO date string for tooltip formatting (first session of the day) */
  sessionStartedAt: string;
  /** Session ID (first session of the day, or comma-joined if multiple) */
  sessionId: string;
  /** Number of sessions aggregated into this data point */
  sessionCount: number;
  /** If true this is a synthetic gap marker, not a real data point */
  isGap?: boolean;
  /** If true this is an invisible boundary sentinel at the timeline edge */
  isBoundary?: boolean;
}

export interface DropTimelinePointMetrics {
  /** Expected drops for this point based on timeline baseline rate. */
  anticipatedDrops: number;
}

export interface LeagueMarker {
  time: number;
  label: string;
  type: "start" | "end";
  emphasis?: "highlight" | "muted";
}

export type DropTimelineMetricKey =
  | "drops-per-day"
  | "anticipated"
  | "decks-opened"
  | "league-start";

export interface InactivityGapRange {
  startTime: number;
  endTime: number;
}
