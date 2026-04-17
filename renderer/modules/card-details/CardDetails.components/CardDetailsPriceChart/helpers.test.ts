import { describe, expect, it } from "vitest";

import {
  formatAxisDate,
  formatDate,
  formatDateFull,
  formatRate,
  formatVolume,
} from "./helpers";

// ═══════════════════════════════════════════════════════════════════════════
// formatDate
// ═══════════════════════════════════════════════════════════════════════════

describe("formatDate", () => {
  it("formats an ISO string to short month and day", () => {
    const result = formatDate("2024-01-15T10:00:00Z");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatDateFull
// ═══════════════════════════════════════════════════════════════════════════

describe("formatDateFull", () => {
  it("formats an ISO string to month, day, and year", () => {
    const result = formatDateFull("2024-06-20T00:00:00Z");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/20/);
    expect(result).toMatch(/2024/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatAxisDate
// ═══════════════════════════════════════════════════════════════════════════

describe("formatAxisDate", () => {
  it("formats a timestamp to short month and day", () => {
    const timestamp = new Date("2024-03-05T12:00:00Z").getTime();
    const result = formatAxisDate(timestamp);
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/5/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatRate (YAxis rate tickFormatter)
// ═══════════════════════════════════════════════════════════════════════════

describe("formatRate", () => {
  it("formats an integer to one decimal place", () => {
    expect(formatRate(5)).toBe("5.0");
  });

  it("formats a float to one decimal place", () => {
    expect(formatRate(1.23)).toBe("1.2");
  });

  it("formats zero", () => {
    expect(formatRate(0)).toBe("0.0");
  });

  it("rounds correctly", () => {
    expect(formatRate(1.99)).toBe("2.0");
    expect(formatRate(0.05)).toBe("0.1");
    expect(formatRate(0.04)).toBe("0.0");
  });

  it("formats large numbers", () => {
    expect(formatRate(1234.5)).toBe("1234.5");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatVolume (YAxis volume tickFormatter)
// ═══════════════════════════════════════════════════════════════════════════

describe("formatVolume", () => {
  it('returns "1.0M" for 1,000,000', () => {
    expect(formatVolume(1_000_000)).toBe("1.0M");
  });

  it('returns "2.5M" for 2,500,000', () => {
    expect(formatVolume(2_500_000)).toBe("2.5M");
  });

  it('returns "45K" for 45,000', () => {
    expect(formatVolume(45_000)).toBe("45K");
  });

  it('returns "1K" for 1,000', () => {
    expect(formatVolume(1_000)).toBe("1K");
  });

  it('returns "500" for 500', () => {
    expect(formatVolume(500)).toBe("500");
  });

  it('returns "0" for 0', () => {
    expect(formatVolume(0)).toBe("0");
  });

  it("handles boundary between K and M", () => {
    expect(formatVolume(999_999)).toBe("1000K");
    expect(formatVolume(1_000_001)).toBe("1.0M");
  });

  it("handles boundary between plain and K", () => {
    expect(formatVolume(999)).toBe("999");
    expect(formatVolume(1_001)).toBe("1K");
  });
});
