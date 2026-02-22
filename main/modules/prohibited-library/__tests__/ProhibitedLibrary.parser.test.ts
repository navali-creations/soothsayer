import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deriveFromBoss,
  isPatchVersionHeader,
  parseProhibitedLibraryCsv,
  resolveCsvPath,
  splitCsvLine,
  weightToDropRarity,
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

    it("should parse card name, bucket, weight, rawLeagueLabel, and fromBoss for each row", () => {
      const result = parseProhibitedLibraryCsv(buildCsv());

      // "Rain of Chaos,1,5,5,,121400,121400,121400,"
      // currentLeagueIndex is the column before "All samples" = index 7 ("Keepers")
      const rainOfChaos = result.rows.find(
        (r) => r.cardName === "Rain of Chaos",
      );
      expect(rainOfChaos).toBeDefined();
      expect(rainOfChaos!.bucket).toBe(1);
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
    it("should set fromBoss = false when Ritual column is a numeric value", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Boon of Justice,17,85,4,,7967,7068,9128,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].fromBoss).toBe(false);
    });

    it('should set fromBoss = true when Ritual column is the text "Boss"', () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "The Void,26,125,Boss,,9636,9253,9922,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].fromBoss).toBe(true);
    });

    it('should handle "Boss" text case-insensitively', () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Some Card,26,125,boss,,9636,9253,9922,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].fromBoss).toBe(true);
    });

    it("should set fromBoss = false for any non-Boss value", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Rain of Chaos,1,5,5,,121400,121400,121400,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].fromBoss).toBe(false);
    });

    it("should set fromBoss = false when column D is empty", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "No Ritual Card,10,50,,,5000,5000,5000,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);
      expect(result.rows[0].fromBoss).toBe(false);
    });

    it("should handle multiple rows with mixed Ritual values including Boss text", () => {
      const csv = buildCsv({
        rows: [
          "Sample Size,,,,,219942,55898,22189,1768829",
          "Regular Card,5,25,5,,24000,25000,26000,",
          "Ritual Tier4 Card,17,85,4,,8000,7000,9000,",
          "Boss Card Text,26,125,Boss,,9636,9253,9922,",
          "Tier2 Card,10,50,2,,5000,5000,5000,",
          "Weird Card,10,50,7,,5000,5000,5000,",
        ],
      });

      const result = parseProhibitedLibraryCsv(csv);

      expect(result.rows[0].fromBoss).toBe(false); // "5" — not "Boss"
      expect(result.rows[1].fromBoss).toBe(false); // "4" — not "Boss"
      expect(result.rows[2].fromBoss).toBe(true); // "Boss" text
      expect(result.rows[3].fromBoss).toBe(false); // "2" — not "Boss"
      expect(result.rows[4].fromBoss).toBe(false); // "7" — not "Boss"
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

// ─── weightToDropRarity (absolute weight thresholds) ─────────────────────────

describe("weightToDropRarity", () => {
  describe("rarity 4 — common (weight > 5000)", () => {
    it("should return 4 for very high weights", () => {
      expect(weightToDropRarity(121400)).toBe(4); // Rain of Chaos
    });

    it("should return 4 for weight just above threshold", () => {
      expect(weightToDropRarity(5001)).toBe(4);
    });

    it("should return 4 for typical common card weights", () => {
      expect(weightToDropRarity(7390)).toBe(4); // Lucky Connections
      expect(weightToDropRarity(55799)).toBe(4); // Emperor's Luck
      expect(weightToDropRarity(64413)).toBe(4); // The Lover
    });
  });

  describe("rarity 3 — less common (weight 1001–5000)", () => {
    it("should return 3 for weight at upper boundary", () => {
      expect(weightToDropRarity(5000)).toBe(3);
    });

    it("should return 3 for weight just above lower boundary", () => {
      expect(weightToDropRarity(1001)).toBe(3);
    });

    it("should return 3 for mid-range weights", () => {
      expect(weightToDropRarity(3000)).toBe(3);
    });
  });

  describe("rarity 2 — rare (weight 31–1000)", () => {
    it("should return 2 for weight at upper boundary", () => {
      expect(weightToDropRarity(1000)).toBe(2);
    });

    it("should return 2 for weight just above lower boundary", () => {
      expect(weightToDropRarity(31)).toBe(2);
    });

    it("should return 2 for mid-range rare weights", () => {
      expect(weightToDropRarity(500)).toBe(2);
    });
  });

  describe("rarity 1 — extremely rare (weight ≤ 30)", () => {
    it("should return 1 for weight at threshold", () => {
      expect(weightToDropRarity(30)).toBe(1);
    });

    it("should return 1 for single-digit weights", () => {
      expect(weightToDropRarity(5)).toBe(1); // The Apothecary
      expect(weightToDropRarity(1)).toBe(1);
    });

    it("should return 1 for weight of 16 (The Doctor)", () => {
      expect(weightToDropRarity(16)).toBe(1);
    });

    it("should return 1 for weight of 29 (Brother's Gift)", () => {
      expect(weightToDropRarity(29)).toBe(1);
    });
  });

  describe("boundary transitions", () => {
    it("transition at weight 30 → 31 (rarity 1 → 2)", () => {
      expect(weightToDropRarity(30)).toBe(1);
      expect(weightToDropRarity(31)).toBe(2);
    });

    it("transition at weight 1000 → 1001 (rarity 2 → 3)", () => {
      expect(weightToDropRarity(1000)).toBe(2);
      expect(weightToDropRarity(1001)).toBe(3);
    });

    it("transition at weight 5000 → 5001 (rarity 3 → 4)", () => {
      expect(weightToDropRarity(5000)).toBe(3);
      expect(weightToDropRarity(5001)).toBe(4);
    });
  });

  it("should always return a value in range 1–4", () => {
    for (const w of [
      1, 5, 10, 15, 20, 21, 50, 100, 500, 1000, 1001, 3000, 5000, 5001, 10000,
      50000, 121400,
    ]) {
      const rarity = weightToDropRarity(w);
      expect(rarity).toBeGreaterThanOrEqual(1);
      expect(rarity).toBeLessThanOrEqual(4);
    }
  });
});

// ─── deriveFromBoss ──────────────────────────────────────────────────────────

describe("deriveFromBoss", () => {
  it('should return true for "Boss" text', () => {
    expect(deriveFromBoss("Boss")).toBe(true);
  });

  it('should return true for "boss" (case-insensitive)', () => {
    expect(deriveFromBoss("boss")).toBe(true);
  });

  it('should return true for "BOSS" (case-insensitive)', () => {
    expect(deriveFromBoss("BOSS")).toBe(true);
  });

  it.each([
    "1",
    "2",
    "3",
    "4",
    "5",
    "7",
    "99",
  ])("should return false for numeric value %s", (value) => {
    expect(deriveFromBoss(value)).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(deriveFromBoss("")).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(deriveFromBoss(undefined)).toBe(false);
  });

  it("should return false for any non-Boss text", () => {
    expect(deriveFromBoss("Unknown")).toBe(false);
    expect(deriveFromBoss("Regular")).toBe(false);
    expect(deriveFromBoss("Tier")).toBe(false);
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

describe("parse → weightToDropRarity integration", () => {
  it("should parse the default fixture and convert all weights to valid rarities", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());

    for (const row of result.rows) {
      if (row.weight > 0) {
        const rarity = weightToDropRarity(row.weight);
        expect(rarity).toBeGreaterThanOrEqual(1);
        expect(rarity).toBeLessThanOrEqual(4);
      } else {
        // Weight 0 means no stacked deck data — rarity 0 (unknown)
        // regardless of boss status
        expect(row.weight).toBe(0);
      }
    }
  });

  it("should assign rarity 0 (unknown) for cards with zero weight regardless of boss status", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());

    // "The Doctor,26,,5,,0,0,0," — weight is 0 → rarity 0 (unknown)
    const theDoctor = result.rows.find((r) => r.cardName === "The Doctor");
    expect(theDoctor).toBeDefined();
    expect(theDoctor!.weight).toBe(0);
    expect(theDoctor!.bucket).toBe(26);

    // Weight 0 = no stacked deck data → rarity 0, boss status is irrelevant
    const rarity =
      theDoctor!.weight > 0 ? weightToDropRarity(theDoctor!.weight) : 0;
    expect(rarity).toBe(0);
  });

  it("should assign highest rarity (4) to Rain of Chaos (weight 121400)", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());

    const rainOfChaos = result.rows.find((r) => r.cardName === "Rain of Chaos");
    expect(rainOfChaos).toBeDefined();
    expect(weightToDropRarity(rainOfChaos!.weight)).toBe(4);
  });

  it("should assign common rarity to all high-weight cards in fixture", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());

    // All non-zero-weight cards in the default fixture have weight > 5000
    // Rain of Chaos=121400, Emperor's Luck=55799, The Lover=64413, Boon of Justice=9128
    const withWeight = result.rows.filter((r) => r.weight > 0);
    expect(withWeight.length).toBeGreaterThan(0);
    for (const row of withWeight) {
      expect(weightToDropRarity(row.weight)).toBe(4); // all > 5000
    }
  });

  it("should identify zero-weight cards as not in Stacked Decks", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());

    // The Doctor has weight=0 in the fixture → not available in Stacked Decks
    const zeroWeightCards = result.rows.filter((r) => r.weight === 0);
    expect(zeroWeightCards.length).toBeGreaterThan(0);

    // Zero-weight cards get rarity based on fromBoss:
    // - boss → rarity 1 (extremely rare)
    // - non-boss → rarity 0 (unknown)
    for (const card of zeroWeightCards) {
      expect(card.weight).toBe(0);
    }
  });

  it("should correctly separate boss and non-boss cards (only 'Boss' text = boss)", () => {
    const result = parseProhibitedLibraryCsv(buildCsv());

    const bossCards = result.rows.filter((r) => r.fromBoss);
    const regularCards = result.rows.filter((r) => !r.fromBoss);

    // Default fixture: Boon of Justice has Ritual=4, which is NOT boss anymore
    // No card in the default fixture has Ritual="Boss", so 0 boss cards
    expect(bossCards).toHaveLength(0);

    expect(regularCards).toHaveLength(5);
    expect(regularCards.map((r) => r.cardName)).toContain("Rain of Chaos");
    expect(regularCards.map((r) => r.cardName)).toContain("Emperor's Luck");
    expect(regularCards.map((r) => r.cardName)).toContain("The Lover");
    expect(regularCards.map((r) => r.cardName)).toContain("Boon of Justice");
    expect(regularCards.map((r) => r.cardName)).toContain("The Doctor");
  });

  it("should mark cards as boss only when Ritual column is text 'Boss'", () => {
    const csv = buildCsv({
      rows: [
        "Sample Size,,,,,219942,55898,22189,1768829",
        "Rain of Chaos,1,5,5,,121400,121400,121400,",
        "The Void,26,125,Boss,,0,0,0,",
        "Lucky Connections,19,95,4,,7291,7356,7390,",
      ],
    });

    const result = parseProhibitedLibraryCsv(csv);

    const theVoid = result.rows.find((r) => r.cardName === "The Void");
    expect(theVoid!.fromBoss).toBe(true);

    const luckyConnections = result.rows.find(
      (r) => r.cardName === "Lucky Connections",
    );
    expect(luckyConnections!.fromBoss).toBe(false);
    expect(weightToDropRarity(luckyConnections!.weight)).toBe(4); // weight 7390 = common
  });
});

// ─── splitCsvLine ────────────────────────────────────────────────────────────

describe("splitCsvLine", () => {
  it("should split a simple comma-separated line", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("should trim whitespace from fields", () => {
    expect(splitCsvLine(" a , b , c ")).toEqual(["a", "b", "c"]);
  });

  it("should handle empty fields", () => {
    expect(splitCsvLine("a,,c")).toEqual(["a", "", "c"]);
  });

  it("should handle trailing comma (empty last field)", () => {
    expect(splitCsvLine("a,b,")).toEqual(["a", "b", ""]);
  });

  it("should handle a quoted field containing a comma", () => {
    expect(splitCsvLine('"hello, world",b,c')).toEqual([
      "hello, world",
      "b",
      "c",
    ]);
  });

  it("should handle a quoted field at the end", () => {
    expect(splitCsvLine('a,b,"hello, world"')).toEqual([
      "a",
      "b",
      "hello, world",
    ]);
  });

  it("should handle escaped quotes inside a quoted field", () => {
    expect(splitCsvLine('"say ""hello""",b')).toEqual(['say "hello"', "b"]);
  });

  it("should handle multiple quoted fields", () => {
    expect(splitCsvLine('"a,1","b,2",c')).toEqual(["a,1", "b,2", "c"]);
  });

  it("should handle the real Brush, Paint and Palette row", () => {
    const line =
      '"Brush, Paint and Palette",35,250,3,3,661,465,675,479,622,612,552,588,674,754,';
    const fields = splitCsvLine(line);

    expect(fields[0]).toBe("Brush, Paint and Palette");
    expect(fields[1]).toBe("35"); // bucket
    expect(fields[2]).toBe("250"); // Faustus
    expect(fields[3]).toBe("3"); // Ritual
  });

  it("should produce identical results to simple split when no quotes present", () => {
    const line = "Rain of Chaos,1,5,5,,121400,121400,121400,";
    const simple = line.split(",").map((f) => f.trim());
    const quoted = splitCsvLine(line);
    expect(quoted).toEqual(simple);
  });
});

// ─── Quoted card name integration ────────────────────────────────────────────

describe("parseProhibitedLibraryCsv — quoted card names", () => {
  it("should correctly parse a card whose name contains a comma", () => {
    const csv = buildCsv({
      rows: [
        "Sample Size,,,,,219942,55898,22189,1768829",
        '"Brush, Paint and Palette",35,250,3,3,661,465,675,754,',
        "Rain of Chaos,1,5,5,,121400,121400,121400,",
      ],
    });

    const result = parseProhibitedLibraryCsv(csv);

    expect(result.rows).toHaveLength(2);

    const brush = result.rows.find(
      (r) => r.cardName === "Brush, Paint and Palette",
    );
    expect(brush).toBeDefined();
    expect(brush!.bucket).toBe(35);
    expect(brush!.weight).toBe(675); // Keepers column (index 7)
    expect(brush!.fromBoss).toBe(false);

    const rain = result.rows.find((r) => r.cardName === "Rain of Chaos");
    expect(rain).toBeDefined();
    expect(rain!.weight).toBe(121400);
  });

  it("should correctly identify bucket and weight for quoted card names", () => {
    const csv = buildCsv({
      rows: [
        "Sample Size,,,,,219942,55898,22189,1768829",
        '"Brush, Paint and Palette",35,250,4,3,661,465,675,754,',
      ],
    });

    const result = parseProhibitedLibraryCsv(csv);
    expect(result.rows).toHaveLength(1);

    const card = result.rows[0];
    expect(card.cardName).toBe("Brush, Paint and Palette");
    expect(card.bucket).toBe(35);
    expect(card.fromBoss).toBe(false);
  });
});
