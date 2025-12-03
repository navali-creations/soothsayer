import type { PoeNinjaResponse } from "../../types/poe-ninja";

export async function fetchDivinationCardPrices(
  league: string = "Keepers",
): Promise<PoeNinjaResponse> {
  const response = await fetch(
    `https://poe.ninja/api/data/itemoverview?league=${league}&type=DivinationCard`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch divination card prices: ${response.statusText}`,
    );
  }

  return response.json();
}

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

export function getChaosValue(
  chaosValue: number,
  chaosToDivineRatio: number,
): number {
  return chaosValue >= chaosToDivineRatio
    ? chaosValue / chaosToDivineRatio
    : chaosValue;
}
