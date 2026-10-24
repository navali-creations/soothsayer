export function formatDropChance(count: number, sampleSize: number): string {
  return formatDropProbability(count / sampleSize);
}

export function formatDropProbability(probability: number): string {
  return `${(probability * 100).toFixed(6)}%`;
}
