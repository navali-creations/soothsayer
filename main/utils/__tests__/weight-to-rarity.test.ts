import { describe, expect, it } from "vitest";

import { weightToDropRarity } from "../weight-to-rarity";

describe("weightToDropRarity", () => {
  describe("rarity 4 — Common (weight > 5000)", () => {
    it.each([121400, 5001, 7390, 55799, 64413])("weight %d → rarity 4", (w) => {
      expect(weightToDropRarity(w)).toBe(4);
    });
  });

  describe("rarity 3 — Less common (1000 < weight ≤ 5000)", () => {
    it.each([5000, 1001, 3000])("weight %d → rarity 3", (w) => {
      expect(weightToDropRarity(w)).toBe(3);
    });
  });

  describe("rarity 2 — Rare (30 < weight ≤ 1000)", () => {
    it.each([1000, 31, 500])("weight %d → rarity 2", (w) => {
      expect(weightToDropRarity(w)).toBe(2);
    });
  });

  describe("rarity 1 — Extremely rare (weight ≤ 30)", () => {
    it.each([30, 5, 1, 16, 29])("weight %d → rarity 1", (w) => {
      expect(weightToDropRarity(w)).toBe(1);
    });
  });

  describe("boundary transitions", () => {
    it("30 → 31 transitions from rarity 1 to 2", () => {
      expect(weightToDropRarity(30)).toBe(1);
      expect(weightToDropRarity(31)).toBe(2);
    });

    it("1000 → 1001 transitions from rarity 2 to 3", () => {
      expect(weightToDropRarity(1000)).toBe(2);
      expect(weightToDropRarity(1001)).toBe(3);
    });

    it("5000 → 5001 transitions from rarity 3 to 4", () => {
      expect(weightToDropRarity(5000)).toBe(3);
      expect(weightToDropRarity(5001)).toBe(4);
    });
  });

  describe("range validation", () => {
    it("always returns a value between 1 and 4", () => {
      const testValues = [
        0, 1, 15, 30, 31, 500, 1000, 1001, 3000, 5000, 5001, 100000,
      ];
      for (const w of testValues) {
        const result = weightToDropRarity(w);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(4);
      }
    });
  });
});
