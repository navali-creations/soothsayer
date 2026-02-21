import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Rarity } from "~/types/data-stores";

import {
  bucketToFallbackRarity,
  isPatchVersionHeader,
  parseProhibitedLibraryCsv,
  resolveCsvPath,
  weightToRarity,
} from "../ProhibitedLibrary.parser";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

/**
 * Build a minimal valid CSV string for testing.
 * Mirrors the real Prohibited Library "Weights" tab structure.
 *
 * Columns: patch,Bucket,Faustus,Ritual,Ultimatum,3.25,3.26,Keepers,All samples
 */
function buildCsv(
  options: {
    headers?: string;
    rows?: string[];
    lineEnding?: "\n" | "\r\n";
  } = {},
): string {
  const {
    headers = "patch,Bucket,Faustus,Ritual,Ultimatum,3.25,3.26,Keepers,All samples",
    rows = [
      "Sample Size,,,,,219942,55898,22189,1768829",
      "Rain of Chaos,1,5,5,,121400,121400,121400,",
      "Emperor's Luck,2,10,5,,51720,49357,55799,",
      "The Lover,2,10,5,,63571,65856,64413,",
      "Boon of Justice,17,85,4,,7967,7068,9128,",
      "The Doctor,26,,5,,0,0,0,",
    ],
    lineEnding = "\n",
  } = options;

  return [headers, ...rows].join(lineEnding);
}

/** The league label used in the default test CSV fixture. */
const DEFAULT_LEAGUE = "Keepers";

// ─── parseProhibitedLibraryCsv ───────────────────────────────────────────────

describe("parseProhibitedLibraryCsv", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Header detection ────────────────────────────────────────────────

  describe("header-row column detection", () => {
    it("should identify the current-league column as the one immediately before 'All samples'", () => {
      const result = parseProhibitedLibraryCsv(buildCsv());
      expect(result.rawLeagueLabel).toBe(DEFAULT_LEAGUE);
    });

    it("should find current-league column dynamically when new columns are added before 'All samples'", () => {
      const csv = buildCsv({
        headers:
          "patch,Bucket,Faustus,Ritual,Ultimatum,3.25,3.26,Keepers,Settlers,All samples",
        rows: [
          "Sample Size,,,,,,,,9999,1768829",
          "Rain of Chaos,1,5,5,,121400,121400,121400,99999,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rawLeagueLabel).toBe("Settlers");
    });

    it("should handle headers with extra whitespace via trim", () => {
      const csv = buildCsv({
        headers:
          "patch , Bucket , Faustus , Ritual , Ultimatum , 3.26 , Keepers , All samples",
        rows: ["Rain of Chaos,1,5,5,,121400,121400,"],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rawLeagueLabel).toBe("Keepers");
      expect(result.rows.length).toBe(1);
    });
  });

  // ── Error handling ──────────────────────────────────────────────────

  describe("error handling", () => {
    it("should throw if the CSV is too short (empty string)", () => {
      expect(() => parseProhibitedLibraryCsv("")).toThrow(/too short/);
    });

    it("should throw if the CSV has only a header row without 'All samples'", () => {
      // A single header line that lacks "All samples" — triggers the missing column check.
      expect(() => parseProhibitedLibraryCsv("patch,Bucket,Faustus")).toThrow(
        /does not contain "All samples"/,
      );
    });

    it("should return zero rows when the CSV has a valid header but no data rows", () => {
      const csv =
        "patch,Bucket,Faustus,Ritual,Ultimatum,3.25,3.26,Keepers,All samples";
      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows).toHaveLength(0);
      expect(result.rawLeagueLabel).toBe("Keepers");
    });

    it("should throw if 'All samples' column is missing", () => {
      const csv = buildCsv({
        headers: "patch,Bucket,Faustus,Ritual,Ultimatum,3.25,3.26,Keepers",
      });

      expect(() => parseProhibitedLibraryCsv(csv)).toThrow(
        /does not contain "All samples"/,
      );
    });

    it("should throw if 'All samples' is the first column (no preceding league column)", () => {
      const csv = "All samples,patch,Bucket\n100,Rain of Chaos,1";

      expect(() => parseProhibitedLibraryCsv(csv)).toThrow(
        /no preceding column/,
      );
    });

    it("should throw if the current-league column header is a patch version number", () => {
      // Headers where the column before "All samples" is "3.26" (a patch version)
      const csv = buildCsv({
        headers: "patch,Bucket,Faustus,Ritual,Ultimatum,3.25,3.26,All samples",
        rows: [
          "Sample Size,,,,,219942,55898,1768829",
          "Rain of Chaos,1,5,5,,121400,121400,",
        ],
      });

      expect(() => parseProhibitedLibraryCsv(csv)).toThrow(
        /looks like a patch version number/,
      );
    });
  });

  // ── Row parsing ─────────────────────────────────────────────────────

  describe("row parsing", () => {
    it("should return the correct rawLeagueLabel", () => {
      const result = parseProhibitedLibraryCsv(buildCsv());
      expect(result.rawLeagueLabel).toBe(DEFAULT_LEAGUE);
    });

    it("should skip the 'Sample Size' aggregate row (row index 1)", () => {
      const result = parseProhibitedLibraryCsv(buildCsv());
      const cardNames = result.rows.map((r) => r.cardName);

      expect(cardNames).not.toContain("Sample Size");
    });

    it("should skip rows where the card name is empty", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Rain of Chaos,1,5,5,,121400,121400,121400,",
          ",,,,,,,", // empty card name
          "  ,,,,,,,", // whitespace-only card name
          "Emperor's Luck,2,10,5,,51720,49357,55799,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      const cardNames = result.rows.map((r) => r.cardName);

      expect(cardNames).toEqual(["Rain of Chaos", "Emperor's Luck"]);
    });

    it("should skip completely empty lines", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Rain of Chaos,1,5,5,,121400,121400,121400,",
          "", // empty line
          "Emperor's Luck,2,10,5,,51720,49357,55799,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows).toHaveLength(2);
    });

    it("should parse card name, bucket, ritualValue, weight, and rawLeagueLabel for each row", () => {
      const result = parseProhibitedLibraryCsv(buildCsv());

      // "Rain of Chaos,1,5,5,,121400,121400,121400,"
      // currentLeagueIndex is the column before "All samples" = index 7 ("Keepers")
      const rainOfChaos = result.rows.find(
        (r) => r.cardName === "Rain of Chaos",
      );
      expect(rainOfChaos).toBeDefined();
      expect(rainOfChaos!.bucket).toBe(1);
      expect(rainOfChaos!.ritualValue).toBe(5);
      expect(rainOfChaos!.weight).toBe(121400);
      expect(rainOfChaos!.rawLeagueLabel).toBe(DEFAULT_LEAGUE);
      expect(rainOfChaos!.fromBoss).toBe(false);
    });

    it("should parse all data rows from the default fixture (excluding Sample Size)", () => {
      const result = parseProhibitedLibraryCsv(buildCsv());

      // Default fixture has: Rain of Chaos, Emperor's Luck, The Lover, Boon of Justice, The Doctor
      expect(result.rows).toHaveLength(5);
    });

    it("should parse weight as 0 when the current-league weight cell is empty", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "The Doctor,26,,5,,,,,", // all weight columns empty
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].weight).toBe(0);
    });

    it("should parse bucket as 0 when bucket cell is empty", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Some Card,,5,5,,100,100,100,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].bucket).toBe(0);
    });
  });

  // ── from_boss mapping ───────────────────────────────────────────────

  describe("from_boss column-D mapping", () => {
    it("should set fromBoss = true when ritualValue is 4", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Boon of Justice,17,85,4,,7967,7068,9128,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].fromBoss).toBe(true);
      expect(result.rows[0].ritualValue).toBe(4);
    });

    it("should set fromBoss = false when ritualValue is 5", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Rain of Chaos,1,5,5,,121400,121400,121400,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].fromBoss).toBe(false);
      expect(result.rows[0].ritualValue).toBe(5);
    });

    it("should default to fromBoss = false and log a warning for unexpected ritualValue", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Mystery Card,10,50,3,,5000,5000,5000,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].fromBoss).toBe(false);
      expect(result.rows[0].ritualValue).toBe(3);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Unexpected ritualValue 3 for card "Mystery Card"',
        ),
      );
    });

    it("should default to fromBoss = false when ritualValue is 0 (empty column D) and log a warning", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "No Ritual Card,10,50,,,5000,5000,5000,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].fromBoss).toBe(false);
      expect(result.rows[0].ritualValue).toBe(0);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple rows with mixed ritualValues", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Regular Card,5,25,5,,24000,25000,26000,",
          "Boss Card,17,85,4,,8000,7000,9000,",
          "Weird Card,10,50,7,,5000,5000,5000,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);

      expect(result.rows[0].fromBoss).toBe(false); // ritualValue 5
      expect(result.rows[1].fromBoss).toBe(true); // ritualValue 4
      expect(result.rows[2].fromBoss).toBe(false); // ritualValue 7 (unexpected)

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Weird Card"),
      );
    });
  });

  // ── Line endings ────────────────────────────────────────────────────

  describe("line ending handling", () => {
    it("should handle \\n line endings", () => {
      const csv = buildCsv({ lineEnding: "\n" });
      const result = parseProhibitedLibraryCsv(csv);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rawLeagueLabel).toBe(DEFAULT_LEAGUE);
    });

    it("should handle \\r\\n line endings", () => {
      const csv = buildCsv({ lineEnding: "\r\n" });
      const result = parseProhibitedLibraryCsv(csv);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rawLeagueLabel).toBe(DEFAULT_LEAGUE);
    });

    it("should produce identical results regardless of line ending style", () => {
      const lf = parseProhibitedLibraryCsv(buildCsv({ lineEnding: "\n" }));
      const crlf = parseProhibitedLibraryCsv(buildCsv({ lineEnding: "\r\n" }));

      expect(lf.rawLeagueLabel).toBe(crlf.rawLeagueLabel);
      expect(lf.rows).toEqual(crlf.rows);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle a CSV with only the header and Sample Size row (no data cards)", () => {
      const csv = buildCsv({
        rows: ["Sample Size,,,,,219942,55898,22189,1768829"],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows).toHaveLength(0);
      expect(result.rawLeagueLabel).toBe(DEFAULT_LEAGUE);
    });

    it("should handle a single data row (besides header and Sample Size)", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Rain of Chaos,1,5,5,,121400,121400,121400,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].cardName).toBe("Rain of Chaos");
    });

    it("should handle trailing empty lines at end of file", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Rain of Chaos,1,5,5,,121400,121400,121400,",
          "",
          "",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows).toHaveLength(1);
    });

    it("should handle cards with apostrophes in names", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Emperor's Luck,2,10,5,,51720,49357,55799,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].cardName).toBe("Emperor's Luck");
    });

    it("should handle rows with fewer columns than the current-league index (weight defaults to 0)", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Short Row,1,5,5", // only 4 columns, league column is index 7
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].cardName).toBe("Short Row");
      expect(result.rows[0].weight).toBe(0);
    });

    it("should not treat 'Sample Size' case-sensitively — only exact match is skipped", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "sample size,1,5,5,,100,100,100,", // lowercase — should NOT be skipped
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].cardName).toBe("sample size");
    });
  });
});

// ─── weightToRarity ──────────────────────────────────────────────────────────

describe("weightToRarity", () => {
  // Use maxWeight = 121400 (Rain of Chaos from the real data) as the baseline

  const maxWeight = 121400;

  it("should return rarity 4 (common) for weight at 100% of max", () => {
    expect(weightToRarity(121400, maxWeight)).toBe(4);
  });

  it("should return rarity 4 (common) for weight at exactly 70% of max", () => {
    // 70% of 121400 = 84980
    expect(weightToRarity(84980, maxWeight)).toBe(4);
  });

  it("should return rarity 3 (less common) for weight just below 70% of max", () => {
    // Just under 70%
    expect(weightToRarity(84979, maxWeight)).toBe(3);
  });

  it("should return rarity 3 (less common) for weight at exactly 35% of max", () => {
    // 35% of 121400 = 42490
    expect(weightToRarity(42490, maxWeight)).toBe(3);
  });

  it("should return rarity 2 (rare) for weight just below 35% of max", () => {
    // Just under 35%
    expect(weightToRarity(42489, maxWeight)).toBe(2);
  });

  it("should return rarity 2 (rare) for weight at exactly 5% of max", () => {
    // 5% of 121400 = 6070
    expect(weightToRarity(6070, maxWeight)).toBe(2);
  });

  it("should return rarity 1 (extremely rare) for weight just below 5% of max", () => {
    // Just under 5%
    expect(weightToRarity(6069, maxWeight)).toBe(1);
  });

  it("should return rarity 1 (extremely rare) for weight of 0", () => {
    expect(weightToRarity(0, maxWeight)).toBe(1);
  });

  it("should return rarity 1 (extremely rare) for weight of 1", () => {
    expect(weightToRarity(1, maxWeight)).toBe(1);
  });

  // ── Normalised percentage boundary tests ────────────────────────────

  describe("with maxWeight = 100 for clean percentage boundaries", () => {
    it("pct = 100 → rarity 4", () => {
      expect(weightToRarity(100, 100)).toBe(4);
    });

    it("pct = 70 → rarity 4", () => {
      expect(weightToRarity(70, 100)).toBe(4);
    });

    it("pct = 69.99 → rarity 3", () => {
      expect(weightToRarity(69.99, 100)).toBe(3);
    });

    it("pct = 35 → rarity 3", () => {
      expect(weightToRarity(35, 100)).toBe(3);
    });

    it("pct = 34.99 → rarity 2", () => {
      expect(weightToRarity(34.99, 100)).toBe(2);
    });

    it("pct = 5 → rarity 2", () => {
      expect(weightToRarity(5, 100)).toBe(2);
    });

    it("pct = 4.99 → rarity 1", () => {
      expect(weightToRarity(4.99, 100)).toBe(1);
    });

    it("pct = 0 → rarity 1", () => {
      expect(weightToRarity(0, 100)).toBe(1);
    });
  });

  // ── Defensive edge cases ────────────────────────────────────────────

  describe("defensive edge cases", () => {
    it("should return rarity 0 (unknown) when maxWeight is 0", () => {
      expect(weightToRarity(50, 0)).toBe(0);
    });

    it("should return rarity 0 (unknown) when maxWeight is negative", () => {
      expect(weightToRarity(50, -10)).toBe(0);
    });

    it("should return rarity 4 when weight equals maxWeight (both positive)", () => {
      expect(weightToRarity(500, 500)).toBe(4);
    });

    it("should return rarity 4 when weight exceeds maxWeight", () => {
      // Shouldn't happen in practice, but defensively: 200% → rarity 4
      expect(weightToRarity(200, 100)).toBe(4);
    });

    it("should always return a value in range 1–4 for positive maxWeight", () => {
      const weights = [0, 1, 2, 50, 99, 100, 200, 1000, 121400];
      const maxWeights = [1, 10, 100, 121400];

      for (const w of weights) {
        for (const m of maxWeights) {
          const rarity = weightToRarity(w, m);
          expect(rarity).toBeGreaterThanOrEqual(1);
          expect(rarity).toBeLessThanOrEqual(4);
        }
      }
    });

    it("should always return 0 for zero or negative maxWeight", () => {
      const weights = [0, 1, 50, 100, 121400];
      const badMaxWeights = [0, -1, -100];

      for (const w of weights) {
        for (const m of badMaxWeights) {
          expect(weightToRarity(w, m)).toBe(0);
        }
      }
    });
  });

  // ── Real data validation ────────────────────────────────────────────

  describe("with real data weights (maxWeight = 121400)", () => {
    // Rain of Chaos: 121400 → 100% → rarity 4
    it("Rain of Chaos (weight 121400) → rarity 4", () => {
      expect(weightToRarity(121400, 121400)).toBe(4);
    });

    // Emperor's Luck: 55799 → ~46% → rarity 3
    it("Emperor's Luck (weight 55799) → rarity 3", () => {
      expect(weightToRarity(55799, 121400)).toBe(3);
    });

    // Boon of Justice: 9128 → ~7.5% → rarity 2
    it("Boon of Justice (weight 9128) → rarity 2", () => {
      expect(weightToRarity(9128, 121400)).toBe(2);
    });

    // The Doctor: 0 → 0% → rarity 1
    it("The Doctor (weight 0) → rarity 1", () => {
      expect(weightToRarity(0, 121400)).toBe(1);
    });
  });
});

// ─── bucketToFallbackRarity ──────────────────────────────────────────────────

describe("bucketToFallbackRarity", () => {
  describe("bucket 1–5 → rarity 4 (common)", () => {
    it.each([1, 2, 3, 4, 5])("bucket %d → rarity 4", (bucket) => {
      expect(bucketToFallbackRarity(bucket)).toBe(4);
    });
  });

  describe("bucket 6–12 → rarity 3 (uncommon)", () => {
    it.each([6, 7, 8, 9, 10, 11, 12])("bucket %d → rarity 3", (bucket) => {
      expect(bucketToFallbackRarity(bucket)).toBe(3);
    });
  });

  describe("bucket 13–17 → rarity 2 (rare)", () => {
    it.each([13, 14, 15, 16, 17])("bucket %d → rarity 2", (bucket) => {
      expect(bucketToFallbackRarity(bucket)).toBe(2);
    });
  });

  describe("bucket 18+ → rarity 1 (very rare)", () => {
    it.each([
      18, 19, 20, 21, 25, 26, 50, 100,
    ])("bucket %d → rarity 1", (bucket) => {
      expect(bucketToFallbackRarity(bucket)).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("bucket 0 → rarity 1 (conservative fallback)", () => {
      expect(bucketToFallbackRarity(0)).toBe(1);
    });

    it("negative bucket → rarity 1 (conservative fallback)", () => {
      expect(bucketToFallbackRarity(-1)).toBe(1);
      expect(bucketToFallbackRarity(-100)).toBe(1);
    });

    it("NaN bucket → rarity 1 (conservative fallback)", () => {
      expect(bucketToFallbackRarity(NaN)).toBe(1);
    });

    it("should always return a value in range 1–4", () => {
      for (let b = -5; b <= 50; b++) {
        const rarity = bucketToFallbackRarity(b);
        expect(rarity).toBeGreaterThanOrEqual(1);
        expect(rarity).toBeLessThanOrEqual(4);
      }
    });
  });

  // ── Boundary checks ────────────────────────────────────────────────

  describe("boundary transitions", () => {
    it("transition at bucket 5 → 6 (rarity 4 → 3)", () => {
      expect(bucketToFallbackRarity(5)).toBe(4);
      expect(bucketToFallbackRarity(6)).toBe(3);
    });

    it("transition at bucket 12 → 13 (rarity 3 → 2)", () => {
      expect(bucketToFallbackRarity(12)).toBe(3);
      expect(bucketToFallbackRarity(13)).toBe(2);
    });

    it("transition at bucket 17 → 18 (rarity 2 → 1)", () => {
      expect(bucketToFallbackRarity(17)).toBe(2);
      expect(bucketToFallbackRarity(18)).toBe(1);
    });
  });
});

// ─── isPatchVersionHeader ────────────────────────────────────────────────────

describe("isPatchVersionHeader", () => {
  describe("should return true for patch version strings", () => {
    it.each([
      "3.18",
      "3.19",
      "3.20",
      "3.21",
      "3.22",
      "3.23",
      "3.24",
      "3.25",
      "3.26",
    ])('"%s" → true', (header) => {
      expect(isPatchVersionHeader(header)).toBe(true);
    });

    it("should match other numeric patterns too", () => {
      expect(isPatchVersionHeader("4.0")).toBe(true);
      expect(isPatchVersionHeader("10.20")).toBe(true);
      expect(isPatchVersionHeader("1.0")).toBe(true);
    });
  });

  describe("should return false for league names", () => {
    it.each([
      "Keepers",
      "Settlers",
      "Ritual",
      "Ultimatum",
      "Standard",
    ])('"%s" → false', (header) => {
      expect(isPatchVersionHeader(header)).toBe(false);
    });
  });

  describe("should return false for other non-patch strings", () => {
    it.each([
      "All samples",
      "patch",
      "Bucket",
      "Faustus",
      "",
      "abc",
      "3.18.1", // three-part version — not matched by ^\d+\.\d+$
      "v3.18",
      "3",
      ".18",
      "3.",
    ])('"%s" → false', (header) => {
      expect(isPatchVersionHeader(header)).toBe(false);
    });
  });

  describe("patch version validation in parser (integration)", () => {
    it("should reject CSV where current-league column is a patch version like '3.26'", () => {
      const csv = buildCsv({
        headers: "patch,Bucket,Faustus,Ritual,Ultimatum,3.25,3.26,All samples",
      });

      expect(() => parseProhibitedLibraryCsv(csv)).toThrow(
        /patch version number/,
      );
    });

    it("should accept CSV where current-league column is a league name like 'Keepers'", () => {
      const csv = buildCsv();
      // Should not throw
      expect(() => parseProhibitedLibraryCsv(csv)).not.toThrow();
    });
  });
});

// ─── resolveCsvPath ──────────────────────────────────────────────────────────

describe("resolveCsvPath", () => {
  const mockResourcesPath = "/mock-resources";
  const mockAppPath = "/mock-app";

  // ── PoE1 paths ──────────────────────────────────────────────────────

  describe("poe1", () => {
    it("should return packaged path when isPackaged is true", () => {
      const result = resolveCsvPath(
        "poe1",
        true,
        mockResourcesPath,
        mockAppPath,
      );

      expect(result).toBe(
        join(mockResourcesPath, "poe1", "prohibited-library-weights.csv"),
      );
    });

    it("should return dev path when isPackaged is false", () => {
      const result = resolveCsvPath(
        "poe1",
        false,
        mockResourcesPath,
        mockAppPath,
      );

      expect(result).toBe(
        join(
          mockAppPath,
          "renderer",
          "assets",
          "poe1",
          "prohibited-library-weights.csv",
        ),
      );
    });

    it("packaged path must NOT contain 'renderer/assets' prefix (regression guard)", () => {
      const result = resolveCsvPath(
        "poe1",
        true,
        mockResourcesPath,
        mockAppPath,
      );

      // Normalise to forward slashes for cross-platform assertion
      const normalised = result!.replace(/\\/g, "/");
      expect(normalised).not.toContain("renderer/assets");
    });

    it("dev path SHOULD contain 'renderer/assets' prefix", () => {
      const result = resolveCsvPath(
        "poe1",
        false,
        mockResourcesPath,
        mockAppPath,
      );

      const normalised = result!.replace(/\\/g, "/");
      expect(normalised).toContain("renderer/assets");
    });

    it("packaged path should use resourcesPath as base", () => {
      const result = resolveCsvPath(
        "poe1",
        true,
        "/custom/resources/path",
        mockAppPath,
      );

      const normalised = result!.replace(/\\/g, "/");
      expect(normalised).toContain("/custom/resources/path/");
    });

    it("dev path should use appPath as base", () => {
      const result = resolveCsvPath(
        "poe1",
        false,
        mockResourcesPath,
        "/custom/app/path",
      );

      const normalised = result!.replace(/\\/g, "/");
      expect(normalised).toContain("/custom/app/path/");
    });
  });

  // ── PoE2 ────────────────────────────────────────────────────────────

  describe("poe2", () => {
    it("should return null for poe2 (not yet supported)", () => {
      expect(
        resolveCsvPath("poe2", false, mockResourcesPath, mockAppPath),
      ).toBeNull();
    });

    it("should return null for poe2 even when packaged", () => {
      expect(
        resolveCsvPath("poe2", true, mockResourcesPath, mockAppPath),
      ).toBeNull();
    });
  });

  // ── Regression guard: realistic packaged paths ──────────────────────

  describe("regression guard — realistic paths", () => {
    it("Windows packaged path should NOT contain renderer/assets", () => {
      const result = resolveCsvPath(
        "poe1",
        true,
        "C:\\Users\\test\\AppData\\Local\\soothsayer\\resources",
        "C:\\Users\\test\\AppData\\Local\\soothsayer\\resources\\app.asar",
      );

      const normalised = result!.replace(/\\/g, "/");
      expect(normalised).not.toContain("renderer/assets");
      expect(normalised).toContain("/resources/poe1/");
    });

    it("macOS packaged path should NOT contain renderer/assets", () => {
      const result = resolveCsvPath(
        "poe1",
        true,
        "/Applications/Soothsayer.app/Contents/Resources",
        "/Applications/Soothsayer.app/Contents/Resources/app.asar",
      );

      const normalised = result!.replace(/\\/g, "/");
      expect(normalised).not.toContain("renderer/assets");
      expect(normalised).toContain("/Resources/poe1/");
    });

    it("Linux packaged path should NOT contain renderer/assets", () => {
      const result = resolveCsvPath(
        "poe1",
        true,
        "/opt/soothsayer/resources",
        "/opt/soothsayer/resources/app.asar",
      );

      const normalised = result!.replace(/\\/g, "/");
      expect(normalised).not.toContain("renderer/assets");
      expect(normalised).toContain("/resources/poe1/");
    });
  });
});

// ─── Integration: parse + convert flow ───────────────────────────────────────

describe("parse → weightToRarity integration", () => {
  it("should parse the default fixture and convert all weights to valid rarities", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());

    // Find max weight across parsed rows
    const maxWeight = Math.max(...result.rows.map((r) => r.weight));

    for (const row of result.rows) {
      let rarity: Rarity;
      if (row.weight > 0) {
        rarity = weightToRarity(row.weight, maxWeight);
      } else {
        rarity = bucketToFallbackRarity(row.bucket);
      }

      expect(rarity).toBeGreaterThanOrEqual(1);
      expect(rarity).toBeLessThanOrEqual(4);
    }
  });

  it("should use bucket fallback for cards with zero weight", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());

    // "The Doctor,26,,5,,0,0,0," — weight is 0, bucket is 26
    const theDoctor = result.rows.find((r) => r.cardName === "The Doctor");
    expect(theDoctor).toBeDefined();
    expect(theDoctor!.weight).toBe(0);
    expect(theDoctor!.bucket).toBe(26);

    const rarity = bucketToFallbackRarity(theDoctor!.bucket);
    expect(rarity).toBe(1); // bucket 26 → 18+ → rarity 1 (very rare)
  });

  it("should assign highest rarity (4) to the most common card via weightToRarity", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());
    const maxWeight = Math.max(...result.rows.map((r) => r.weight));

    const rainOfChaos = result.rows.find((r) => r.cardName === "Rain of Chaos");
    expect(rainOfChaos).toBeDefined();
    expect(rainOfChaos!.weight).toBe(maxWeight);

    expect(weightToRarity(rainOfChaos!.weight, maxWeight)).toBe(4);
  });

  it("should correctly separate boss and non-boss cards", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());

    const bossCards = result.rows.filter((r) => r.fromBoss);
    const regularCards = result.rows.filter((r) => !r.fromBoss);

    // Default fixture has 1 boss card (Boon of Justice) and 4 regular
    expect(bossCards).toHaveLength(1);
    expect(bossCards[0].cardName).toBe("Boon of Justice");

    expect(regularCards).toHaveLength(4);
    expect(regularCards.map((r) => r.cardName)).toContain("Rain of Chaos");
    expect(regularCards.map((r) => r.cardName)).toContain("Emperor's Luck");
    expect(regularCards.map((r) => r.cardName)).toContain("The Lover");
    expect(regularCards.map((r) => r.cardName)).toContain("The Doctor");
  });
});
