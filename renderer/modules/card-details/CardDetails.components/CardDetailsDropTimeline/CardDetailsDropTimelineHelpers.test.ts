import { describe, expect, it } from "vitest";

import {
  formatAxisDate,
  leagueEndTime,
  leagueStartTime,
} from "~/renderer/modules/card-details/CardDetails.components/CardDetailsDropTimeline/helpers";

// ─── leagueEndTime ─────────────────────────────────────────────────────────

describe("leagueEndTime", () => {
  it("returns the endDate timestamp when endDate is provided", () => {
    const endDate = "2026-06-15T00:00:00Z";
    const result = leagueEndTime({
      name: "Settlers",
      startDate: "2026-03-01T00:00:00Z",
      endDate,
    });
    expect(result).toBe(new Date(endDate).getTime());
  });

  it("infers end time as next league start minus 3 days when endDate is missing", () => {
    const startDate = "2026-03-01T00:00:00Z";
    const nextStartDate = "2026-06-01T00:00:00Z";
    const result = leagueEndTime(
      {
        name: "Settlers",
        startDate,
        endDate: null,
      },
      [
        { name: "Settlers", startDate, endDate: null },
        { name: "Mercenaries", startDate: nextStartDate, endDate: null },
      ],
    );
    expect(result).toBe(
      new Date(nextStartDate).getTime() - 3 * 24 * 60 * 60 * 1000,
    );
  });

  it("returns inferred 4-month cap when endDate is null and there is no next league", () => {
    const startDate = "2025-03-01T00:00:00Z";
    const result = leagueEndTime(
      {
        name: "Settlers",
        startDate,
        endDate: null,
      },
      [{ name: "Settlers", startDate, endDate: null }],
    );
    const expected =
      new Date(startDate).getTime() + 4 * 30 * 24 * 60 * 60 * 1000;
    expect(result).toBe(expected);
  });

  it("returns approximately Date.now() when league is recent and missing endDate", () => {
    const startDate = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const before = Date.now();
    const result = leagueEndTime(
      {
        name: "Settlers",
        startDate,
        endDate: null,
      },
      [{ name: "Settlers", startDate, endDate: null }],
    );
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns approximately Date.now() when both startDate and endDate are null", () => {
    const before = Date.now();
    const result = leagueEndTime({
      name: "Unknown",
      startDate: null,
      endDate: null,
    });
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("prefers explicit endDate over inferred next-league end", () => {
    const startDate = "2026-01-01T00:00:00Z";
    const endDate = "2026-02-01T00:00:00Z";
    const result = leagueEndTime(
      {
        name: "Keepers",
        startDate,
        endDate,
      },
      [
        { name: "Keepers", startDate, endDate },
        {
          name: "Mercenaries",
          startDate: "2026-03-01T00:00:00Z",
          endDate: null,
        },
      ],
    );
    expect(result).toBe(new Date(endDate).getTime());
  });

  it("falls back to start-date inference when endDate is invalid", () => {
    const startDate = "2026-01-01T00:00:00Z";
    const nextStartDate = "2026-02-01T00:00:00Z";

    const result = leagueEndTime(
      {
        name: "Keepers",
        startDate,
        endDate: "not-a-date",
      },
      [
        { name: "Keepers", startDate, endDate: "not-a-date" },
        { name: "Mirage", startDate: nextStartDate, endDate: null },
      ],
    );

    expect(result).toBe(
      new Date(nextStartDate).getTime() - 3 * 24 * 60 * 60 * 1000,
    );
  });

  it("ignores invalid current and next league start dates", () => {
    const before = Date.now();
    const result = leagueEndTime(
      {
        name: "Broken",
        startDate: "not-a-date",
        endDate: null,
      },
      [
        { name: "Broken", startDate: "not-a-date", endDate: null },
        { name: "AlsoBroken", startDate: "also-not-a-date", endDate: null },
      ],
    );
    const after = Date.now();

    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

// ─── leagueStartTime ──────────────────────────────────────────────────────

describe("leagueStartTime", () => {
  it("returns the startDate timestamp when startDate is provided", () => {
    const startDate = "2026-03-01T00:00:00Z";
    const result = leagueStartTime({
      name: "Settlers",
      startDate,
      endDate: "2026-06-15T00:00:00Z",
    });
    expect(result).toBe(new Date(startDate).getTime());
  });

  it("returns 0 when startDate is null", () => {
    const result = leagueStartTime({
      name: "Unknown",
      startDate: null,
      endDate: null,
    });
    expect(result).toBe(0);
  });
});

// ─── formatAxisDate ────────────────────────────────────────────────────────

describe("formatAxisDate", () => {
  it("formats a timestamp as 'Mon D' (short month + day)", () => {
    // Jan 15, 2026 UTC
    const timestamp = new Date("2026-01-15T12:00:00Z").getTime();
    const result = formatAxisDate(timestamp);
    // The exact output depends on locale, but for en-US it should contain "Jan" and "15"
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("returns empty string for 0", () => {
    expect(formatAxisDate(0)).toBe("");
  });

  it("returns empty string for NaN", () => {
    expect(formatAxisDate(NaN)).toBe("");
  });

  it("returns empty string for Infinity", () => {
    expect(formatAxisDate(Infinity)).toBe("");
  });

  it("formats different months correctly", () => {
    const july4 = new Date("2026-07-04T00:00:00Z").getTime();
    const result = formatAxisDate(july4);
    expect(result).toContain("Jul");
    expect(result).toContain("4");
  });
});
