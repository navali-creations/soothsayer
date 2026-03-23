import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatSessionDate,
  formatSessionTime,
  getUniqueLeagues,
} from "./Sessions.utils";

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Sessions.utils", () => {
  // ── formatDuration ───────────────────────────────────────────────────────

  describe("formatDuration", () => {
    it("returns minutes only when < 60", () => {
      expect(formatDuration(45)).toBe("45m");
    });

    it("returns 0m for zero minutes", () => {
      expect(formatDuration(0)).toBe("0m");
    });

    it("returns hours and minutes when >= 60", () => {
      expect(formatDuration(125)).toBe("2h 5m");
    });

    it("returns exact hours with 0m remainder", () => {
      expect(formatDuration(120)).toBe("2h 0m");
    });

    it("returns 1h 0m for exactly 60 minutes", () => {
      expect(formatDuration(60)).toBe("1h 0m");
    });

    it("returns 1h 1m for 61 minutes", () => {
      expect(formatDuration(61)).toBe("1h 1m");
    });

    it("handles large values", () => {
      expect(formatDuration(600)).toBe("10h 0m");
    });
  });

  // ── formatSessionDate ────────────────────────────────────────────────────

  describe("formatSessionDate", () => {
    it("formats a valid ISO date string", () => {
      const result = formatSessionDate("2024-01-15T10:00:00Z");
      // en-US: "Jan 15, 2024"
      expect(result).toContain("Jan");
      expect(result).toContain("15");
      expect(result).toContain("2024");
    });

    it("formats another valid date correctly", () => {
      const result = formatSessionDate("2023-12-25T00:00:00Z");
      expect(result).toContain("Dec");
      expect(result).toContain("25");
      expect(result).toContain("2023");
    });

    it('returns "Unknown date" for an empty string', () => {
      expect(formatSessionDate("")).toBe("Unknown date");
    });

    it('returns "Invalid date" for an invalid date string', () => {
      expect(formatSessionDate("not-a-date")).toBe("Invalid date");
    });

    it('returns "Invalid date" for a malformed date', () => {
      expect(formatSessionDate("2024-99-99")).toBe("Invalid date");
    });
  });

  // ── formatSessionTime ────────────────────────────────────────────────────

  describe("formatSessionTime", () => {
    it("returns a formatted time string", () => {
      const result = formatSessionTime("2024-01-15T14:30:00Z");
      // Should contain hour and minute components; exact format depends on locale
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
      // The result should contain a colon separating hours and minutes
      expect(result).toContain(":");
    });

    it("formats midnight correctly", () => {
      const result = formatSessionTime("2024-01-15T00:00:00Z");
      expect(result).toBeTruthy();
      expect(result).toContain(":");
    });
  });

  // ── getUniqueLeagues ─────────────────────────────────────────────────────

  describe("getUniqueLeagues", () => {
    it('returns ["all"] for an empty array', () => {
      expect(getUniqueLeagues([])).toEqual(["all"]);
    });

    it('returns "all" followed by unique league names', () => {
      const sessions = [
        { league: "Settlers" },
        { league: "Standard" },
        { league: "Settlers" },
      ];
      const result = getUniqueLeagues(sessions);

      expect(result[0]).toBe("all");
      expect(result).toContain("Settlers");
      expect(result).toContain("Standard");
    });

    it("deduplicates league names", () => {
      const sessions = [
        { league: "Settlers" },
        { league: "Settlers" },
        { league: "Settlers" },
      ];
      const result = getUniqueLeagues(sessions);

      // "all" + one unique league
      expect(result).toHaveLength(2);
      expect(result).toEqual(["all", "Settlers"]);
    });

    it("handles a single session", () => {
      const sessions = [{ league: "Necropolis" }];
      const result = getUniqueLeagues(sessions);

      expect(result).toEqual(["all", "Necropolis"]);
    });

    it("preserves all unique leagues from many sessions", () => {
      const sessions = [
        { league: "A" },
        { league: "B" },
        { league: "C" },
        { league: "A" },
        { league: "B" },
      ];
      const result = getUniqueLeagues(sessions);

      expect(result).toHaveLength(4); // "all" + A, B, C
      expect(result[0]).toBe("all");
      expect(result).toContain("A");
      expect(result).toContain("B");
      expect(result).toContain("C");
    });
  });
});
