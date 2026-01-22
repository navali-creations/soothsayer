export function formatCurrency(
  chaosValue: number,
  chaosToDivineRatio: number,
): string {
  if (chaosValue >= chaosToDivineRatio) {
    const divineValue = chaosValue / chaosToDivineRatio;
    return `${divineValue.toFixed(2)}d`;
  }
  return `${chaosValue.toFixed(2)}c`;
}
