import { describe, expect, it } from "vitest";

import {
  clampAndMergeCompressedRanges,
  createCompressedLinearMapper,
  normalizeNumericDomain,
} from "./time-compression";

describe("time-compression", () => {
  describe("normalizeNumericDomain", () => {
    it("keeps non-zero-width domains unchanged", () => {
      expect(normalizeNumericDomain(10, 20)).toEqual({ min: 10, max: 20 });
    });

    it("expands zero-width domains by 1 on both sides", () => {
      expect(normalizeNumericDomain(42, 42)).toEqual({ min: 41, max: 43 });
    });
  });

  describe("clampAndMergeCompressedRanges", () => {
    it("clamps, filters and merges overlapping ranges", () => {
      const ranges = clampAndMergeCompressedRanges(
        [
          { startTime: -10, endTime: 5 },
          { startTime: 4, endTime: 8 },
          { startTime: 30, endTime: 20 },
          { startTime: 90, endTime: 120 },
        ],
        0,
        100,
      );

      expect(ranges).toEqual([
        { startTime: 0, endTime: 8 },
        { startTime: 90, endTime: 100 },
      ]);
    });
  });

  describe("createCompressedLinearMapper", () => {
    it("falls back to linear mapping when no compressed ranges are provided", () => {
      const map = createCompressedLinearMapper({
        domainMin: 0,
        domainMax: 100,
        pixelMin: 0,
        pixelMax: 100,
        compressedRanges: [],
        compressedRangeWidthPx: 20,
      });

      expect(map(0)).toBeCloseTo(0, 6);
      expect(map(50)).toBeCloseTo(50, 6);
      expect(map(100)).toBeCloseTo(100, 6);
    });

    it("compresses specified ranges to fixed pixel width", () => {
      const map = createCompressedLinearMapper({
        domainMin: 0,
        domainMax: 100,
        pixelMin: 0,
        pixelMax: 100,
        compressedRanges: [{ startTime: 40, endTime: 60 }],
        compressedRangeWidthPx: 10,
      });

      // Start of compressed range shifts right because active ranges scale up.
      expect(map(40)).toBeCloseTo(45, 6);
      // Midpoint in compressed range maps to compressed-lane center.
      expect(map(50)).toBeCloseTo(50, 6);
      expect(map(60)).toBeCloseTo(55, 6);
      // Domain bounds remain bound to pixel bounds.
      expect(map(0)).toBeCloseTo(0, 6);
      expect(map(100)).toBeCloseTo(100, 6);
    });

    it("clamps out-of-domain values to domain bounds", () => {
      const map = createCompressedLinearMapper({
        domainMin: 0,
        domainMax: 100,
        pixelMin: 0,
        pixelMax: 100,
        compressedRanges: [{ startTime: 40, endTime: 60 }],
        compressedRangeWidthPx: 10,
      });

      expect(map(-999)).toBeCloseTo(0, 6);
      expect(map(999)).toBeCloseTo(100, 6);
    });
  });
});
