export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[i]}`;
}

export function formatPercentage(fraction: number): string {
  if (fraction <= 0) return "0%";
  const pct = fraction * 100;
  if (pct < 0.01) return "< 0.01%";
  return `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
}

export function gameLabel(game: "poe1" | "poe2"): string {
  return game === "poe1" ? "PoE1" : "PoE2";
}
