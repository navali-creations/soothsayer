import type { CardDropTimelinePointDTO } from "~/main/modules/card-details/CardDetails.dto";

// Types

export type ChartDataPoint = CardDropTimelinePointDTO;

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
