import { describe, expect, it } from "vitest";

import { DEFAULT_LEAGUE_DURATION_MS } from "~/renderer/modules/card-details/CardDetails.components/CardDetailsDropTimeline/constants";
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

  it("returns startDate + DEFAULT_LEAGUE_DURATION_MS when endDate is null but startDate exists", () => {
    const startDate = "2026-03-01T00:00:00Z";
    const result = leagueEndTime({
      name: "Settlers",
      startDate,
      endDate: null,
    });
    expect(result).toBe(
      new Date(startDate).getTime() + DEFAULT_LEAGUE_DURATION_MS,
    );
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

  it("prefers endDate over startDate + duration", () => {
    const startDate = "2026-01-01T00:00:00Z";
    const endDate = "2026-02-01T00:00:00Z";
    const result = leagueEndTime({
      name: "Keepers",
      startDate,
      endDate,
    });
    // endDate is before startDate + 4 months, so if endDate is preferred it should be endDate
    expect(result).toBe(new Date(endDate).getTime());
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
