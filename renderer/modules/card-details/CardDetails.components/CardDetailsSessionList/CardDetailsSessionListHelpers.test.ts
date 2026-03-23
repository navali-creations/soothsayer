import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDuration,
} from "~/renderer/modules/card-details/CardDetails.components/CardDetailsSessionList/helpers";

// ─── formatDate ────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats an ISO date string as 'Mon DD, YYYY'", () => {
    const result = formatDate("2026-01-15T12:00:00Z");
    expect(result).toBe("Jan 15, 2026");
  });

  it("formats a date at the start of a year", () => {
    expect(formatDate("2025-01-01T12:00:00Z")).toBe("Jan 1, 2025");
  });

  it("formats a date at mid-year", () => {
    expect(formatDate("2025-07-04T12:00:00Z")).toBe("Jul 4, 2025");
  });

  it("handles various months correctly", () => {
    expect(formatDate("2025-06-05T12:00:00Z")).toBe("Jun 5, 2025");
    expect(formatDate("2025-11-22T12:00:00Z")).toBe("Nov 22, 2025");
  });
});

// ─── formatDuration ────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("returns an em-dash for null", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("returns an em-dash for undefined (cast via any)", () => {
    // The implementation checks for undefined as well
    expect(formatDuration(undefined as unknown as null)).toBe("—");
  });

  it("returns '<1m' for durations less than 1 minute", () => {
    expect(formatDuration(0)).toBe("<1m");
    expect(formatDuration(0.5)).toBe("<1m");
    expect(formatDuration(0.99)).toBe("<1m");
  });

  it("returns rounded minutes for durations under an hour", () => {
    expect(formatDuration(1)).toBe("1m");
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(59)).toBe("59m");
    expect(formatDuration(59.4)).toBe("59m");
  });

  it("returns exact hours when there are no remaining minutes", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(180)).toBe("3h");
  });

  it("returns hours and minutes for mixed durations", () => {
    expect(formatDuration(61)).toBe("1h 1m");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(150)).toBe("2h 30m");
  });

  it("handles large durations", () => {
    expect(formatDuration(600)).toBe("10h");
    expect(formatDuration(605)).toBe("10h 5m");
  });

  it("rounds remaining minutes correctly", () => {
    // 90.7 → hours=1, remaining=30.7, Math.round(30.7)=31
    expect(formatDuration(90.7)).toBe("1h 31m");
  });

  it("shows exact hours when remainder rounds to 0", () => {
    // 60.3 → hours=1, remaining=0.3, Math.round(0.3)=0
    expect(formatDuration(60.3)).toBe("1h");
  });
});
