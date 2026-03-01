import { describe, expect, it } from "vitest";

import { formatBytes, formatPercentage, gameLabel } from "../storage.utils";

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe("formatBytes", () => {
  it("should return '0 B' for 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("should format bytes (< 1 KB)", () => {
    expect(formatBytes(1)).toBe("1.00 B");
    expect(formatBytes(512)).toBe("512.0 B");
    expect(formatBytes(1023)).toBe("1023.0 B");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1536)).toBe("1.50 KB");
    expect(formatBytes(10 * 1024)).toBe("10.0 KB");
    expect(formatBytes(999 * 1024)).toBe("999.0 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
    expect(formatBytes(82 * 1024 * 1024)).toBe("82.0 MB");
    expect(formatBytes(245 * 1024 * 1024)).toBe("245.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.50 MB");
  });

  it("should format gigabytes", () => {
    expect(formatBytes(1024 ** 3)).toBe("1.00 GB");
    expect(formatBytes(953 * 1024 ** 3)).toBe("953.0 GB");
    expect(formatBytes(2.5 * 1024 ** 3)).toBe("2.50 GB");
  });

  it("should format terabytes", () => {
    expect(formatBytes(1024 ** 4)).toBe("1.00 TB");
    expect(formatBytes(4 * 1024 ** 4)).toBe("4.00 TB");
    expect(formatBytes(10 * 1024 ** 4)).toBe("10.0 TB");
  });

  it("should use two decimal places for values below 10", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(5 * 1024)).toBe("5.00 KB");
    expect(formatBytes(9.99 * 1024)).toBe("9.99 KB");
  });

  it("should use one decimal place for values 10 and above", () => {
    expect(formatBytes(10 * 1024)).toBe("10.0 KB");
    expect(formatBytes(100 * 1024)).toBe("100.0 KB");
    expect(formatBytes(512 * 1024)).toBe("512.0 KB");
  });
});

// ─── formatPercentage ────────────────────────────────────────────────────────

describe("formatPercentage", () => {
  it("should return '0%' for 0", () => {
    expect(formatPercentage(0)).toBe("0%");
  });

  it("should return '0%' for negative values", () => {
    expect(formatPercentage(-0.5)).toBe("0%");
    expect(formatPercentage(-1)).toBe("0%");
  });

  it("should return '< 0.01%' for very small fractions", () => {
    expect(formatPercentage(0.000001)).toBe("< 0.01%");
    expect(formatPercentage(0.00005)).toBe("< 0.01%");
    expect(formatPercentage(0.00009999)).toBe("< 0.01%");
  });

  it("should use two decimal places for percentages below 1%", () => {
    expect(formatPercentage(0.001)).toBe("0.10%");
    expect(formatPercentage(0.003)).toBe("0.30%");
    expect(formatPercentage(0.0025)).toBe("0.25%");
    expect(formatPercentage(0.0099)).toBe("0.99%");
  });

  it("should use one decimal place for percentages 1% and above", () => {
    expect(formatPercentage(0.01)).toBe("1.0%");
    expect(formatPercentage(0.1)).toBe("10.0%");
    expect(formatPercentage(0.335)).toBe("33.5%");
    expect(formatPercentage(0.5)).toBe("50.0%");
    expect(formatPercentage(1)).toBe("100.0%");
  });

  it("should handle the boundary between < 0.01% and real value", () => {
    // 0.0001 * 100 = 0.01%, which is NOT < 0.01 so it should render
    expect(formatPercentage(0.0001)).toBe("0.01%");
  });
});

// ─── gameLabel ───────────────────────────────────────────────────────────────

describe("gameLabel", () => {
  it("should return 'PoE1' for poe1", () => {
    expect(gameLabel("poe1")).toBe("PoE1");
  });

  it("should return 'PoE2' for poe2", () => {
    expect(gameLabel("poe2")).toBe("PoE2");
  });
});
