import { clamp, createLinearMapper } from "./canvas-primitives";

export interface CompressedRange {
  startTime: number;
  endTime: number;
}

export interface CompressedLinearMapperOptions {
  domainMin: number;
  domainMax: number;
  pixelMin: number;
  pixelMax: number;
  compressedRanges: ReadonlyArray<CompressedRange>;
  compressedRangeWidthPx: number;
}

export function normalizeNumericDomain(
  min: number,
  max: number,
): {
  min: number;
  max: number;
} {
  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }
  return { min, max };
}

export function clampAndMergeCompressedRanges(
  ranges: ReadonlyArray<CompressedRange>,
  domainMin: number,
  domainMax: number,
): CompressedRange[] {
  if (ranges.length === 0 || domainMax <= domainMin) return [];

  const clamped = ranges
    .map((range) => ({
      startTime: Math.max(domainMin, Math.min(domainMax, range.startTime)),
      endTime: Math.max(domainMin, Math.min(domainMax, range.endTime)),
    }))
    .filter((range) => range.endTime > range.startTime)
    .sort((a, b) => a.startTime - b.startTime);

  if (clamped.length <= 1) return clamped;

  const merged: CompressedRange[] = [clamped[0]];
  for (let i = 1; i < clamped.length; i++) {
    const current = clamped[i];
    const previous = merged[merged.length - 1];

    if (current.startTime <= previous.endTime) {
      previous.endTime = Math.max(previous.endTime, current.endTime);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

export function createCompressedLinearMapper({
  domainMin,
  domainMax,
  pixelMin,
  pixelMax,
  compressedRanges,
  compressedRangeWidthPx,
}: CompressedLinearMapperOptions): (value: number) => number {
  const linear = createLinearMapper(domainMin, domainMax, pixelMin, pixelMax);
  const domainSpan = domainMax - domainMin;
  const pixelSpan = pixelMax - pixelMin;

  if (domainSpan <= 0 || pixelSpan <= 0) return linear;

  const ranges = clampAndMergeCompressedRanges(
    compressedRanges,
    domainMin,
    domainMax,
  );
  if (ranges.length === 0) return linear;

  let totalRangeDuration = 0;
  for (const range of ranges) {
    totalRangeDuration += range.endTime - range.startTime;
  }
  const activeDuration = domainSpan - totalRangeDuration;
  if (activeDuration <= 0) return linear;

  const maxRangeWidth = Math.max(0, (pixelSpan - 1) / ranges.length);
  const rangeWidthPx = Math.min(compressedRangeWidthPx, maxRangeWidth);
  if (rangeWidthPx <= 0) return linear;

  const totalRangeWidth = rangeWidthPx * ranges.length;
  const activePixelSpan = pixelSpan - totalRangeWidth;
  if (activePixelSpan <= 0) return linear;

  const activeScale = activePixelSpan / activeDuration;

  return (value: number) => {
    if (!Number.isFinite(value)) return linear(value);

    const t = clamp(value, domainMin, domainMax);
    let currentTime = domainMin;
    let currentX = pixelMin;

    for (const range of ranges) {
      if (t <= range.startTime) {
        return currentX + (t - currentTime) * activeScale;
      }

      currentX += (range.startTime - currentTime) * activeScale;

      if (t < range.endTime) {
        const ratio = (t - range.startTime) / (range.endTime - range.startTime);
        return currentX + ratio * rangeWidthPx;
      }

      currentX += rangeWidthPx;
      currentTime = range.endTime;
    }

    return currentX + (t - currentTime) * activeScale;
  };
}
