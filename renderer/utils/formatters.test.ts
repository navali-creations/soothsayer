import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatCompactBytes,
  formatDurationMs,
  formatNullableBytes,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatShortDateTime,
  formatWholePercent,
} from "./formatters";

describe("formatters", () => {
  it("formats nullable numbers and percentages", () => {
    expect(formatNumber(null)).toBe("n/a");
    expect(formatNumber(Number.NaN)).toBe("n/a");
    expect(formatNumber(59.7)).toBe("60");
    expect(formatPercent(null)).toBe("n/a");
    expect(formatPercent(3.85)).toBe("3.9%");
    expect(formatWholePercent(72.25)).toBe("72%");
  });

  it("formats bytes with spaced and compact units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.50 KB");
    expect(formatBytes(1536 * 1024 ** 2)).toBe("1.50 GB");
    expect(formatBytes(0, { compact: true })).toBe("0B");
    expect(formatCompactBytes(1.43 * 1024 ** 3)).toBe("1.43GB");
    expect(formatNullableBytes(null)).toBe("n/a");
  });

  it("formats short dates and datetimes", () => {
    expect(formatShortDate("2024-05-04T02:54:00.000Z").length).toBeGreaterThan(
      0,
    );
    expect(
      formatShortDateTime("2024-05-04T02:54:00.000Z").length,
    ).toBeGreaterThan(0);
  });

  it("formats millisecond durations", () => {
    expect(formatDurationMs(177_000)).toBe("2m 57s");
    expect(formatDurationMs(3_725_000)).toBe("1h 02m 05s");
    expect(
      formatDurationMs(3_725_000, { includeSecondsWithHours: false }),
    ).toBe("1h 02m");
  });
});
