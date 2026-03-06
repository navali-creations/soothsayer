// ─── Chart Data Point ──────────────────────────────────────────────────────

export interface ChartDataPoint {
  /** Unix timestamp in ms (used for XAxis domain) */
  time: number;
  /** Formatted date label for tooltip/axis */
  dateLabel: string;
  /** Price in divine orbs */
  rate: number;
  /** Trade volume */
  volume: number;
}

// ─── Custom Tooltip Props ──────────────────────────────────────────────────

export interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    payload: ChartDataPoint;
  }>;
  label?: number;
}
