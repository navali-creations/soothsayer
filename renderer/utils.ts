import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
