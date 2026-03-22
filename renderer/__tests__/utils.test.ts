import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscoveredRarityInsightsDTO } from "~/main/modules/rarity-insights/RarityInsights.dto";
import type { Rarity } from "~/types/data-stores";

import {
  cn,
  decodeRaritySourceValue,
  encodeRaritySourceValue,
  formatCurrency,
  formatRelativeTime,
  getAnalyticsRaritySource,
  getRarityStyles,
  RARITY_LABELS,
} from "../utils";

// ─── cn ────────────────────────────────────────────────────────────────────

describe("cn", () => {
  it("combines multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", false && "bar", null, undefined, "baz")).toBe("foo baz");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe(
      "base active",
    );
  });

  it("merges conflicting tailwind classes (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("merges conflicting tailwind color utilities", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("keeps non-conflicting tailwind classes", () => {
    expect(cn("px-2", "py-4", "mt-2")).toBe("px-2 py-4 mt-2");
  });

  it("returns empty string when given no arguments", () => {
    expect(cn()).toBe("");
  });

  it("handles arrays of class names", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });

  it("handles objects with boolean values", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });
});

// ─── formatRelativeTime ────────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  const FIXED_NOW = new Date("2025-06-01T12:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for less than 1 minute ago', () => {
    const thirtySecondsAgo = new Date(FIXED_NOW - 30_000).toISOString();
    expect(formatRelativeTime(thirtySecondsAgo)).toBe("just now");
  });

  it('returns "just now" for 0 seconds ago', () => {
    const now = new Date(FIXED_NOW).toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it('returns "1m ago" for exactly 1 minute ago', () => {
    const oneMinAgo = new Date(FIXED_NOW - 60_000).toISOString();
    expect(formatRelativeTime(oneMinAgo)).toBe("1m ago");
  });

  it('returns "Xm ago" for minutes', () => {
    const thirtyMinsAgo = new Date(FIXED_NOW - 30 * 60_000).toISOString();
    expect(formatRelativeTime(thirtyMinsAgo)).toBe("30m ago");
  });

  it('returns "59m ago" for 59 minutes', () => {
    const fiftyNineMinsAgo = new Date(FIXED_NOW - 59 * 60_000).toISOString();
    expect(formatRelativeTime(fiftyNineMinsAgo)).toBe("59m ago");
  });

  it('returns "1h ago" for exactly 1 hour', () => {
    const oneHourAgo = new Date(FIXED_NOW - 60 * 60_000).toISOString();
    expect(formatRelativeTime(oneHourAgo)).toBe("1h ago");
  });

  it('returns "Xh ago" for hours', () => {
    const fiveHoursAgo = new Date(FIXED_NOW - 5 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(fiveHoursAgo)).toBe("5h ago");
  });

  it('returns "23h ago" for 23 hours', () => {
    const twentyThreeHoursAgo = new Date(
      FIXED_NOW - 23 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeTime(twentyThreeHoursAgo)).toBe("23h ago");
  });

  it('returns "1d ago" for exactly 1 day', () => {
    const oneDayAgo = new Date(FIXED_NOW - 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(oneDayAgo)).toBe("1d ago");
  });

  it('returns "Xd ago" for days under 30', () => {
    const fifteenDaysAgo = new Date(
      FIXED_NOW - 15 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeTime(fifteenDaysAgo)).toBe("15d ago");
  });

  it('returns "29d ago" for 29 days', () => {
    const twentyNineDaysAgo = new Date(
      FIXED_NOW - 29 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeTime(twentyNineDaysAgo)).toBe("29d ago");
  });

  it('returns "1 month ago" (singular) for exactly 30 days', () => {
    const thirtyDaysAgo = new Date(
      FIXED_NOW - 30 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeTime(thirtyDaysAgo)).toBe("1 month ago");
  });

  it('returns "X months ago" (plural) for multiple months', () => {
    const ninetyDaysAgo = new Date(
      FIXED_NOW - 90 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeTime(ninetyDaysAgo)).toBe("3 months ago");
  });

  it('returns "11 months ago" for 364 days', () => {
    const almostAYear = new Date(
      FIXED_NOW - 364 * 24 * 60 * 60_000,
    ).toISOString();
    // 364 / 30 = 12.13 → floor = 12 months
    expect(formatRelativeTime(almostAYear)).toBe("12 months ago");
  });

  it('returns "1 year ago" (singular) for exactly 365 days', () => {
    const oneYearAgo = new Date(
      FIXED_NOW - 365 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeTime(oneYearAgo)).toBe("1 year ago");
  });

  it('returns "X years ago" (plural) for multiple years', () => {
    const threeYearsAgo = new Date(
      FIXED_NOW - 3 * 365 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeTime(threeYearsAgo)).toBe("3 years ago");
  });
});

// ─── formatCurrency ────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  const DIVINE_RATIO = 200;

  it("formats as chaos when value is below the divine ratio", () => {
    expect(formatCurrency(150, DIVINE_RATIO)).toBe("150.00c");
  });

  it("formats as divine when value equals the divine ratio", () => {
    expect(formatCurrency(200, DIVINE_RATIO)).toBe("1.00d");
  });

  it("formats as divine when value exceeds the divine ratio", () => {
    expect(formatCurrency(500, DIVINE_RATIO)).toBe("2.50d");
  });

  it("formats fractional chaos values", () => {
    expect(formatCurrency(99.5, DIVINE_RATIO)).toBe("99.50c");
  });

  it("formats fractional divine values", () => {
    expect(formatCurrency(350, DIVINE_RATIO)).toBe("1.75d");
  });

  it("handles zero", () => {
    expect(formatCurrency(0, DIVINE_RATIO)).toBe("0.00c");
  });

  it("formats negative values below the ratio as chaos", () => {
    expect(formatCurrency(-50, DIVINE_RATIO)).toBe("-50.00c");
  });

  it("formats negative values at or above the ratio (absolute) as divine", () => {
    // Math.abs(-200) === 200 >= 200 → divine
    expect(formatCurrency(-200, DIVINE_RATIO)).toBe("-1.00d");
  });

  it("formats large negative values as divine", () => {
    expect(formatCurrency(-400, DIVINE_RATIO)).toBe("-2.00d");
  });

  it("uses the provided ratio correctly for different ratios", () => {
    expect(formatCurrency(100, 100)).toBe("1.00d");
    expect(formatCurrency(99, 100)).toBe("99.00c");
  });
});

// ─── RARITY_LABELS ─────────────────────────────────────────────────────────

describe("RARITY_LABELS", () => {
  it('maps rarity 0 to "Unknown"', () => {
    expect(RARITY_LABELS[0]).toBe("Unknown");
  });

  it('maps rarity 1 to "Extremely Rare"', () => {
    expect(RARITY_LABELS[1]).toBe("Extremely Rare");
  });

  it('maps rarity 2 to "Rare"', () => {
    expect(RARITY_LABELS[2]).toBe("Rare");
  });

  it('maps rarity 3 to "Less Common"', () => {
    expect(RARITY_LABELS[3]).toBe("Less Common");
  });

  it('maps rarity 4 to "Common"', () => {
    expect(RARITY_LABELS[4]).toBe("Common");
  });

  it("contains exactly 5 entries", () => {
    expect(Object.keys(RARITY_LABELS)).toHaveLength(5);
  });
});

// ─── getRarityStyles ───────────────────────────────────────────────────────

describe("getRarityStyles", () => {
  describe("rarity 0 (Unknown)", () => {
    it("returns empty bgGradient, text, border, beam", () => {
      const styles = getRarityStyles(0);
      expect(styles.bgGradient).toBe("");
      expect(styles.text).toBe("");
      expect(styles.border).toBe("");
      expect(styles.beam).toBe("");
    });

    it("has showBeam false", () => {
      expect(getRarityStyles(0).showBeam).toBe(false);
    });

    it("returns amber-tinted badge colors", () => {
      const styles = getRarityStyles(0);
      expect(styles.badgeBg).toContain("245, 158, 11");
      expect(styles.badgeText).toContain("245, 158, 11");
      expect(styles.badgeBorder).toContain("245, 158, 11");
    });
  });

  describe("rarity 1 (Extremely Rare)", () => {
    it("has showBeam true", () => {
      expect(getRarityStyles(1, "right").showBeam).toBe(true);
    });

    it("has beam set to orangered", () => {
      expect(getRarityStyles(1, "right").beam).toBe("orangered");
    });

    it("interpolates gradient direction to the right", () => {
      const styles = getRarityStyles(1, "right");
      expect(styles.bgGradient).toContain("to right");
    });

    it("interpolates gradient direction to the left", () => {
      const styles = getRarityStyles(1, "left");
      expect(styles.bgGradient).toContain("to left");
    });

    it("uses blue text and border", () => {
      const styles = getRarityStyles(1, "right");
      expect(styles.text).toBe("rgb(0, 0, 255)");
      expect(styles.border).toBe("rgb(0, 0, 255)");
    });

    it("uses white badge background", () => {
      const styles = getRarityStyles(1, "right");
      expect(styles.badgeBg).toBe("rgb(255, 255, 255)");
    });
  });

  describe("rarity 2 (Rare)", () => {
    it("has showBeam true", () => {
      expect(getRarityStyles(2, "right").showBeam).toBe(true);
    });

    it("has beam set to yellow", () => {
      expect(getRarityStyles(2, "left").beam).toBe("yellow");
    });

    it("interpolates gradient direction", () => {
      const styles = getRarityStyles(2, "left");
      expect(styles.bgGradient).toContain("to left");
      expect(styles.bgGradient).toContain("rgb(0, 20, 180)");
    });

    it("uses white text and border", () => {
      const styles = getRarityStyles(2, "right");
      expect(styles.text).toBe("rgb(255, 255, 255)");
      expect(styles.border).toBe("rgb(255, 255, 255)");
    });
  });

  describe("rarity 3 (Less Common)", () => {
    it("has showBeam false", () => {
      expect(getRarityStyles(3, "right").showBeam).toBe(false);
    });

    it("has empty beam", () => {
      expect(getRarityStyles(3, "right").beam).toBe("");
    });

    it("interpolates gradient direction", () => {
      const styles = getRarityStyles(3, "right");
      expect(styles.bgGradient).toContain("to right");
      expect(styles.bgGradient).toContain("rgb(0, 220, 240)");
    });

    it("uses black text and border", () => {
      const styles = getRarityStyles(3, "left");
      expect(styles.text).toBe("rgb(0, 0, 0)");
      expect(styles.border).toBe("rgb(0, 0, 0)");
    });

    it("uses cyan badge colors", () => {
      const styles = getRarityStyles(3, "right");
      expect(styles.badgeBg).toBe("rgb(0, 220, 240)");
      expect(styles.badgeBorder).toBe("rgb(0, 220, 240)");
    });
  });

  describe("rarity 4 (Common / default)", () => {
    it("returns empty bgGradient, text, border, beam", () => {
      const styles = getRarityStyles(4);
      expect(styles.bgGradient).toBe("");
      expect(styles.text).toBe("");
      expect(styles.border).toBe("");
      expect(styles.beam).toBe("");
    });

    it("has showBeam false", () => {
      expect(getRarityStyles(4).showBeam).toBe(false);
    });

    it("returns white glowRgb", () => {
      expect(getRarityStyles(4).glowRgb).toBe("255, 255, 255");
    });

    it("returns subdued semi-transparent badge colors", () => {
      const styles = getRarityStyles(4);
      expect(styles.badgeBg).toContain("rgba(160, 160, 170");
      expect(styles.badgeText).toContain("rgba(200, 200, 210");
      expect(styles.badgeBorder).toContain("rgba(160, 160, 170");
    });
  });

  it("showBeam is true ONLY for rarities 1 and 2", () => {
    const rarities: Rarity[] = [0, 1, 2, 3, 4];
    const beamResults = rarities.map(
      (r) => getRarityStyles(r, "right").showBeam,
    );
    expect(beamResults).toEqual([false, true, true, false, false]);
  });
});

// ─── encodeRaritySourceValue / decodeRaritySourceValue ─────────────────────

describe("encodeRaritySourceValue", () => {
  it('encodes "poe.ninja" source directly', () => {
    expect(encodeRaritySourceValue("poe.ninja", null)).toBe("poe.ninja");
  });

  it('encodes "prohibited-library" source directly', () => {
    expect(encodeRaritySourceValue("prohibited-library", null)).toBe(
      "prohibited-library",
    );
  });

  it('encodes "filter" source with a filter ID as "filter:<id>"', () => {
    expect(encodeRaritySourceValue("filter", "my-filter-123")).toBe(
      "filter:my-filter-123",
    );
  });

  it('encodes "filter" source without a filter ID as just "filter"', () => {
    expect(encodeRaritySourceValue("filter", null)).toBe("filter");
  });

  it('encodes "filter" source with empty string filterId as just "filter"', () => {
    // empty string is falsy, so it should fall through
    expect(encodeRaritySourceValue("filter", "")).toBe("filter");
  });
});

describe("decodeRaritySourceValue", () => {
  it('decodes "poe.ninja" back to source with null filterId', () => {
    expect(decodeRaritySourceValue("poe.ninja")).toEqual({
      raritySource: "poe.ninja",
      filterId: null,
    });
  });

  it('decodes "prohibited-library" back to source with null filterId', () => {
    expect(decodeRaritySourceValue("prohibited-library")).toEqual({
      raritySource: "prohibited-library",
      filterId: null,
    });
  });

  it('decodes "filter:<id>" to filter source with extracted ID', () => {
    expect(decodeRaritySourceValue("filter:my-filter-123")).toEqual({
      raritySource: "filter",
      filterId: "my-filter-123",
    });
  });

  it("handles filter IDs containing colons", () => {
    expect(decodeRaritySourceValue("filter:some:complex:id")).toEqual({
      raritySource: "filter",
      filterId: "some:complex:id",
    });
  });

  it('decodes bare "filter" as filter source with null filterId', () => {
    expect(decodeRaritySourceValue("filter")).toEqual({
      raritySource: "filter",
      filterId: null,
    });
  });
});

describe("encode/decode roundtrip", () => {
  it('roundtrips "poe.ninja"', () => {
    const encoded = encodeRaritySourceValue("poe.ninja", null);
    const decoded = decodeRaritySourceValue(encoded);
    expect(decoded).toEqual({ raritySource: "poe.ninja", filterId: null });
  });

  it('roundtrips "prohibited-library"', () => {
    const encoded = encodeRaritySourceValue("prohibited-library", null);
    const decoded = decodeRaritySourceValue(encoded);
    expect(decoded).toEqual({
      raritySource: "prohibited-library",
      filterId: null,
    });
  });

  it('roundtrips "filter" with an ID', () => {
    const encoded = encodeRaritySourceValue("filter", "abc-def-456");
    const decoded = decodeRaritySourceValue(encoded);
    expect(decoded).toEqual({
      raritySource: "filter",
      filterId: "abc-def-456",
    });
  });

  it('roundtrips "filter" without an ID', () => {
    const encoded = encodeRaritySourceValue("filter", null);
    const decoded = decodeRaritySourceValue(encoded);
    expect(decoded).toEqual({ raritySource: "filter", filterId: null });
  });
});

// ─── getAnalyticsRaritySource ──────────────────────────────────────────────

describe("getAnalyticsRaritySource", () => {
  const makeFilter = (
    id: string,
    type: "online" | "local",
  ): DiscoveredRarityInsightsDTO =>
    ({ id, type }) as DiscoveredRarityInsightsDTO;

  const availableFilters = [
    makeFilter("online-filter-1", "online"),
    makeFilter("local-filter-1", "local"),
    makeFilter("online-filter-2", "online"),
  ];

  it('maps "poe.ninja" to "poe-ninja"', () => {
    expect(getAnalyticsRaritySource("poe.ninja", null, [])).toBe("poe-ninja");
  });

  it('maps "prohibited-library" to "prohibited-library"', () => {
    expect(getAnalyticsRaritySource("prohibited-library", null, [])).toBe(
      "prohibited-library",
    );
  });

  it('maps "filter" with a matching online filter to "online"', () => {
    expect(
      getAnalyticsRaritySource("filter", "online-filter-1", availableFilters),
    ).toBe("online");
  });

  it('maps "filter" with a matching local filter to "local"', () => {
    expect(
      getAnalyticsRaritySource("filter", "local-filter-1", availableFilters),
    ).toBe("local");
  });

  it('maps "filter" with a second matching online filter to "online"', () => {
    expect(
      getAnalyticsRaritySource("filter", "online-filter-2", availableFilters),
    ).toBe("online");
  });

  it('falls back to "local" when filter source has no filterId', () => {
    expect(getAnalyticsRaritySource("filter", null, availableFilters)).toBe(
      "local",
    );
  });

  it('falls back to "local" when filterId does not match any available filter', () => {
    expect(
      getAnalyticsRaritySource(
        "filter",
        "nonexistent-filter",
        availableFilters,
      ),
    ).toBe("local");
  });

  it('falls back to "local" when availableFilters is empty and source is filter', () => {
    expect(getAnalyticsRaritySource("filter", "some-id", [])).toBe("local");
  });
});
