export function formatDropChance(count: number, sampleSize: number): string {
  return `${((count / sampleSize) * 100).toFixed(6)}%`;
}
