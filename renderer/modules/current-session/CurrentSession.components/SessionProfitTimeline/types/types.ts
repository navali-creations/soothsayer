export interface ProfitChartPoint {
  /** X-axis: cumulative deck count at this point */
  x: number;
  /** Y-axis: cumulative profit in chaos at this point */
  profit: number;
  /** Bar height for a notable drop (null if this point has no bar) */
  barValue: number | null;
  /** Card name of the notable drop (for tooltip) */
  cardName: string | null;
  /** Rarity tier of the notable drop (for tooltip + bar color) */
  rarity: 1 | 2 | 3 | null;
}

/** A point on the profit line curve (computed from buckets, not a chart data point). */
export interface LinePoint {
  x: number;
  profit: number;
}
