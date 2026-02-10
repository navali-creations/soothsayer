import { describe, expect, it } from "vitest";

import { jsonToCsv } from "../utils/jsonToCsv";

describe("jsonToCsv", () => {
  // ─── Basic Functionality ─────────────────────────────────────────────────

  describe("basic conversion", () => {
    it("should convert a simple key-value object to CSV with header", () => {
      const data = { "The Doctor": 3 };

      const result = jsonToCsv(data);

      expect(result).toBe("name,amount\nThe Doctor,3");
    });

    it("should convert multiple entries to CSV rows", () => {
      const data = {
        "The Surgeon": 9,
        "The Doctor": 3,
        "Rain of Chaos": 25,
      };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      expect(lines[0]).toBe("name,amount");
      expect(lines).toHaveLength(4); // header + 3 rows
      expect(lines).toContain("The Surgeon,9");
      expect(lines).toContain("The Doctor,3");
      expect(lines).toContain("Rain of Chaos,25");
    });

    it("should always include the 'name,amount' header", () => {
      const data = { "Card A": 1 };

      const result = jsonToCsv(data);

      expect(result.startsWith("name,amount\n")).toBe(true);
    });

    it("should preserve the order of Object.entries", () => {
      const data = {
        "Alpha Card": 1,
        "Beta Card": 2,
        "Gamma Card": 3,
      };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      expect(lines[1]).toBe("Alpha Card,1");
      expect(lines[2]).toBe("Beta Card,2");
      expect(lines[3]).toBe("Gamma Card,3");
    });
  });

  // ─── Empty Input ─────────────────────────────────────────────────────────

  describe("empty input", () => {
    it("should return only the header for an empty object", () => {
      const data = {};

      const result = jsonToCsv(data);

      expect(result).toBe("name,amount\n");
    });
  });

  // ─── Numeric Values ─────────────────────────────────────────────────────

  describe("numeric values", () => {
    it("should handle zero values", () => {
      const data = { "Empty Card": 0 };

      const result = jsonToCsv(data);

      expect(result).toBe("name,amount\nEmpty Card,0");
    });

    it("should handle large numbers", () => {
      const data = { "Popular Card": 999999 };

      const result = jsonToCsv(data);

      expect(result).toContain("Popular Card,999999");
    });

    it("should handle value of 1", () => {
      const data = { "Rare Card": 1 };

      const result = jsonToCsv(data);

      expect(result).toContain("Rare Card,1");
    });
  });

  // ─── Special Characters in Names ─────────────────────────────────────────

  describe("special characters in card names", () => {
    it("should wrap names containing commas in double quotes", () => {
      const data = { "Card, The Great": 5 };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      expect(lines[1]).toBe('"Card, The Great",5');
    });

    it("should escape double quotes by doubling them", () => {
      const data = { 'Card "Rare" Edition': 2 };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      expect(lines[1]).toBe('"Card ""Rare"" Edition",2');
    });

    it("should wrap names containing both commas and quotes", () => {
      const data = { 'Card, "Special"': 1 };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      expect(lines[1]).toBe('"Card, ""Special""",1');
    });

    it("should not wrap names without commas or quotes", () => {
      const data = { "The Doctor": 3 };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      expect(lines[1]).toBe("The Doctor,3");
      // Should not be wrapped in quotes
      expect(lines[1]).not.toMatch(/^"/);
    });

    it("should handle card names with apostrophes without wrapping", () => {
      const data = { "Emperor's Luck": 15 };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      // Apostrophes don't require CSV quoting
      expect(lines[1]).toBe("Emperor's Luck,15");
    });

    it("should handle card names with special words", () => {
      const data = { "A Mother's Parting Gift": 4 };

      const result = jsonToCsv(data);

      expect(result).toContain("A Mother's Parting Gift,4");
    });

    it("should handle card names with 'The' prefix", () => {
      const data = { "The King's Blade": 7 };

      const result = jsonToCsv(data);

      expect(result).toContain("The King's Blade,7");
    });
  });

  // ─── Multiple Entries ────────────────────────────────────────────────────

  describe("multiple entries with mixed names", () => {
    it("should handle a mix of normal and special-character names", () => {
      const data = {
        "Normal Card": 10,
        "Card, With Comma": 5,
        'Card "With Quotes"': 3,
        "Another Normal": 8,
      };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      expect(lines[0]).toBe("name,amount");
      expect(lines[1]).toBe("Normal Card,10");
      expect(lines[2]).toBe('"Card, With Comma",5');
      expect(lines[3]).toBe('"Card ""With Quotes""",3');
      expect(lines[4]).toBe("Another Normal,8");
    });

    it("should produce valid CSV for a realistic card dataset", () => {
      const data = {
        "Rain of Chaos": 45,
        "The Surgeon": 12,
        "Emperor's Luck": 30,
        "The Doctor": 2,
        "The Doppelganger": 8,
        "Her Mask": 15,
        Hubris: 6,
        Loyalty: 9,
        "The Fiend": 1,
        "A Chilling Wind": 3,
      };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      // Header + 10 card rows
      expect(lines).toHaveLength(11);
      expect(lines[0]).toBe("name,amount");

      // Verify each line has exactly one comma (name,amount format)
      for (let i = 1; i < lines.length; i++) {
        // Each line should contain a comma separating name and amount
        expect(lines[i]).toMatch(/,\d+$/);
      }
    });
  });

  // ─── Output Format ──────────────────────────────────────────────────────

  describe("output format", () => {
    it("should use newline (LF) as row separator", () => {
      const data = { "Card A": 1, "Card B": 2 };

      const result = jsonToCsv(data);

      expect(result).not.toContain("\r\n");
      expect(result).toContain("\n");
    });

    it("should not have a trailing newline", () => {
      const data = { "Card A": 1 };

      const result = jsonToCsv(data);

      expect(result.endsWith("\n")).toBe(false);
      expect(result.endsWith("1")).toBe(true);
    });

    it("should produce a string result", () => {
      const data = { "Card A": 1 };

      const result = jsonToCsv(data);

      expect(typeof result).toBe("string");
    });

    it("should use comma as field delimiter", () => {
      const data = { "Simple Card": 42 };

      const result = jsonToCsv(data);
      const dataLine = result.split("\n")[1];

      // The data line should have exactly one comma (the field delimiter)
      const commaCount = (dataLine.match(/,/g) || []).length;
      expect(commaCount).toBe(1);
    });
  });

  // ─── Single-Word Card Names ──────────────────────────────────────────────

  describe("single-word card names", () => {
    it("should handle single-word card names", () => {
      const data = { Hubris: 6 };

      const result = jsonToCsv(data);

      expect(result).toBe("name,amount\nHubris,6");
    });

    it("should handle single-word card names alongside multi-word names", () => {
      const data = {
        Hubris: 6,
        Loyalty: 9,
        "The Doctor": 2,
      };

      const result = jsonToCsv(data);
      const lines = result.split("\n");

      expect(lines).toContain("Hubris,6");
      expect(lines).toContain("Loyalty,9");
      expect(lines).toContain("The Doctor,2");
    });
  });

  // ─── Parsing Roundtrip Validation ────────────────────────────────────────

  describe("roundtrip validation", () => {
    it("should produce CSV that can be parsed back to the same data", () => {
      const originalData: Record<string, number> = {
        "The Doctor": 3,
        "Rain of Chaos": 25,
        Hubris: 6,
      };

      const csv = jsonToCsv(originalData);
      const lines = csv.split("\n");

      // Skip header, parse each row
      const parsed: Record<string, number> = {};
      for (let i = 1; i < lines.length; i++) {
        const lastCommaIndex = lines[i].lastIndexOf(",");
        const name = lines[i].substring(0, lastCommaIndex);
        const amount = Number.parseInt(
          lines[i].substring(lastCommaIndex + 1),
          10,
        );
        parsed[name] = amount;
      }

      expect(parsed["The Doctor"]).toBe(3);
      expect(parsed["Rain of Chaos"]).toBe(25);
      expect(parsed.Hubris).toBe(6);
    });
  });
});
