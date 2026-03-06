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

export interface LeagueMarker {
  time: number;
  label: string;
  type: "start" | "end";
}

export interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: ChartDataPoint;
  radius?: number;
}
