export { formatBytes } from "~/renderer/utils";

export function formatPercentage(fraction: number): string {
  if (fraction <= 0) return "0%";
  const pct = fraction * 100;
  if (pct < 0.01) return "< 0.01%";
  return `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
}

export function gameLabel(game: "poe1" | "poe2"): string {
  return game === "poe1" ? "PoE1" : "PoE2";
}
