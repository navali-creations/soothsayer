import type { useChartColors } from "~/renderer/hooks";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RawDataPoint {
  sessionIndex: number;
  sessionDate: string;
  league: string;
  durationMinutes: number;
  totalDecksOpened: number;
  exchangeNetProfit: number;
  chaosPerDivine: number;
}

export interface ChartDataPoint {
  sessionIndex: number;
  sessionDate: string;
  league: string;
  /** Profit expressed in divines, converted using the session's own chaos:divine ratio */
  profitDivine: number;
  /** Raw profit in chaos — kept for tooltip detail */
  profitChaos: number;
  /** null when zero — Recharts natively skips null dots */
  rawDecks: number | null;
  /** The chaos:divine ratio at the time of this session */
  chaosPerDivine: number;
}

export type MetricKey = "profit" | "decks";

export interface MetricConfig {
  key: MetricKey;
  rawDataKey: "profitDivine" | "rawDecks";
  label: string;
  colorVar: string;
  yAxisId: string;
  rawVisual: "area" | "scatter";
  formatValue: (v: number, d?: ChartDataPoint) => string;
}

export type ChartColors = ReturnType<typeof useChartColors>;

// ─── Formatting helpers ────────────────────────────────────────────────────────

export function formatDivine(divines: number): string {
  if (Math.abs(divines) >= 10) return `${divines.toFixed(1)} div`;
  return `${divines.toFixed(2)} div`;
}

export function formatChaos(chaos: number): string {
  return `${Math.round(chaos).toLocaleString()} c`;
}

export function formatDecks(v: number | null): string {
  if (v == null || v === 0) return "0";
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

// ─── Metric configuration ──────────────────────────────────────────────────────

export const METRICS: MetricConfig[] = [
  {
    key: "decks",
    rawDataKey: "rawDecks",
    label: "Decks Opened",
    colorVar: "secondary",
    yAxisId: "decks",
    rawVisual: "scatter",
    formatValue: (v) => formatDecks(v),
  },
  {
    key: "profit",
    rawDataKey: "profitDivine",
    label: "Profit",
    colorVar: "secondary",
    yAxisId: "profit",
    rawVisual: "area",
    formatValue: (v) => formatDivine(v),
  },
];

// ─── Data transformation ───────────────────────────────────────────────────────

export function transformChartData(data: RawDataPoint[]): ChartDataPoint[] {
  return data.map((d) => {
    const ratio = d.chaosPerDivine;
    const profitDivine = ratio > 0 ? d.exchangeNetProfit / ratio : 0;

    return {
      sessionIndex: d.sessionIndex,
      sessionDate: d.sessionDate,
      league: d.league,
      chaosPerDivine: ratio,
      profitDivine,
      profitChaos: d.exchangeNetProfit,
      rawDecks: d.totalDecksOpened > 0 ? d.totalDecksOpened : null,
    };
  });
}

// ─── Color resolver ────────────────────────────────────────────────────────────

export function resolveColor(c: ChartColors, colorVar: string): string {
  const map: Record<string, string> = {
    primary: c.primary,
    success: c.success,
    warning: c.warning,
    secondary: c.secondary,
  };
  return map[colorVar] ?? c.primary;
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

export const gradientId = (key: string) => `statChartGrad_${key}`;

export function buildXAxisProps(c: ChartColors) {
  return {
    dataKey: "sessionIndex" as const,
    stroke: c.bc10,
    fontSize: 10,
    tickLine: false,
    tick: { fill: c.bc30 },
    interval: "preserveStartEnd" as const,
  };
}

/** Brush range passed from parent to synced chart components. */
export interface BrushRange {
  startIndex: number;
  endIndex: number;
}
