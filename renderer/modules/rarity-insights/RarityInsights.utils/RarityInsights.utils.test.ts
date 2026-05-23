import { describe, expect, it } from "vitest";

import type { FilterThemeDTO } from "~/main/modules/rarity-insights/RarityInsights.dto";

import { toFilterTheme } from "./RarityInsights.utils";

describe("RarityInsights.utils", () => {
  describe("toFilterTheme", () => {
    it("returns null when no theme rows exist", () => {
      expect(toFilterTheme([])).toBeNull();
    });

    it("maps theme rows by rarity", () => {
      const rows: FilterThemeDTO = [
        {
          filterId: "filter-1",
          rarity: 1,
          bgColor: { r: 10, g: 20, b: 30, a: 255 },
          textColor: { r: 240, g: 240, b: 240, a: 255 },
          borderColor: null,
        },
        {
          filterId: "filter-1",
          rarity: 4,
          bgColor: null,
          textColor: null,
          borderColor: { r: 1, g: 2, b: 3, a: 255 },
        },
      ];

      expect(toFilterTheme(rows)).toEqual({
        1: {
          bgColor: { r: 10, g: 20, b: 30, a: 255 },
          textColor: { r: 240, g: 240, b: 240, a: 255 },
          borderColor: null,
        },
        4: {
          bgColor: null,
          textColor: null,
          borderColor: { r: 1, g: 2, b: 3, a: 255 },
        },
      });
    });
  });
});
