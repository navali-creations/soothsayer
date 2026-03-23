import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { formatRelativeDate } from "~/renderer/modules/card-details/helpers/formatRelativeDate";

describe("formatRelativeDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    // Fix "now" to a known point: 2026-06-15T12:00:00.000Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  });

  // ─── Relative formatting ───────────────────────────────────────────────

  it('returns "just now" for a date less than 1 minute ago', () => {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const result = formatRelativeDate(tenSecondsAgo);
    expect(result.relative).toBe("just now");
  });

  it('returns "just now" for the exact current time', () => {
    const now = new Date(Date.now()).toISOString();
    const result = formatRelativeDate(now);
    expect(result.relative).toBe("just now");
  });

  it("returns minutes ago for dates within the last hour", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeDate(fiveMinutesAgo).relative).toBe("5m ago");
  });

  it("returns 1m ago at exactly 1 minute", () => {
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    expect(formatRelativeDate(oneMinAgo).relative).toBe("1m ago");
  });

  it("returns 59m ago at 59 minutes", () => {
    const fiftyNineMinAgo = new Date(Date.now() - 59 * 60_000).toISOString();
    expect(formatRelativeDate(fiftyNineMinAgo).relative).toBe("59m ago");
  });

  it("returns hours ago for dates within the last 24 hours", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(threeHoursAgo).relative).toBe("3h ago");
  });

  it("returns 1h ago at exactly 1 hour", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(formatRelativeDate(oneHourAgo).relative).toBe("1h ago");
  });

  it("returns days ago for dates within the last 30 days", () => {
    const tenDaysAgo = new Date(
      Date.now() - 10 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeDate(tenDaysAgo).relative).toBe("10d ago");
  });

  it("returns 1d ago at exactly 1 day", () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(oneDayAgo).relative).toBe("1d ago");
  });

  it('returns "1 month ago" (singular) for ~30 days', () => {
    const thirtyOneDaysAgo = new Date(
      Date.now() - 31 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeDate(thirtyOneDaysAgo).relative).toBe("1 month ago");
  });

  it('returns "3 months ago" (plural) for ~90 days', () => {
    const ninetyDaysAgo = new Date(
      Date.now() - 91 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeDate(ninetyDaysAgo).relative).toBe("3 months ago");
  });

  it('returns "1 year ago" (singular) for ~365 days', () => {
    const oneYearAgo = new Date(
      Date.now() - 366 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeDate(oneYearAgo).relative).toBe("1 year ago");
  });

  it('returns "2 years ago" (plural) for ~730 days', () => {
    const twoYearsAgo = new Date(
      Date.now() - 731 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelativeDate(twoYearsAgo).relative).toBe("2 years ago");
  });

  // ─── Absolute formatting ───────────────────────────────────────────────

  it("returns an absolute date in 'Mon DD, YYYY' format", () => {
    // 2026-06-15T12:00:00Z minus 5 minutes → still Jun 15, 2026
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeDate(fiveMinAgo).absolute).toBe("Jun 15, 2026");
  });

  it("formats an older date correctly for absolute display", () => {
    const result = formatRelativeDate("2025-12-25T00:00:00.000Z");
    expect(result.absolute).toBe("Dec 25, 2025");
  });

  it("formats a date from a different year", () => {
    const result = formatRelativeDate("2020-01-01T00:00:00.000Z");
    expect(result.absolute).toBe("Jan 1, 2020");
  });

  // ─── Combined check ───────────────────────────────────────────────────

  it("returns both relative and absolute for a 3-month-old date", () => {
    const result = formatRelativeDate("2026-03-15T12:00:00.000Z");
    expect(result.relative).toBe("3 months ago");
    expect(result.absolute).toBe("Mar 15, 2026");
  });
});
