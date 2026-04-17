import type { CardPriceHistoryPointDTO } from "~/main/modules/card-details/CardDetails.dto";

import type { ChartDataPoint } from "./types";

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatDateFull(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAxisDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatRate(value: number): string {
  return value.toFixed(1);
}

export function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function mapHistoryToChartData(
  history: CardPriceHistoryPointDTO[],
): ChartDataPoint[] {
  return history.map((point) => ({
    time: new Date(point.timestamp).getTime(),
    dateLabel: formatDate(point.timestamp),
    rate: point.rate,
    volume: point.volume,
  }));
}
