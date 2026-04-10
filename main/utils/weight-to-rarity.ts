/**
 * Convert a Prohibited Library weight to a drop rarity tier.
 *
 * Thresholds:
 *   weight > 5000  → 4 (Common)
 *   weight > 1000  → 3 (Less common)
 *   weight > 30    → 2 (Rare)
 *   weight ≤ 30    → 1 (Extremely rare)
 */
export function weightToDropRarity(weight: number): 1 | 2 | 3 | 4 {
  if (weight > 5000) return 4;
  if (weight > 1000) return 3;
  if (weight > 30) return 2;
  return 1;
}
