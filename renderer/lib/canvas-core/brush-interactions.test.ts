import { describe, expect, it } from "vitest";

import {
  brushDeltaIndexFromPixels,
  brushDeltaValueFromPixels,
  chartDeltaIndexFromPixels,
  collapseFullNumericBrushRange,
  hitTestIndexBrush,
  hitTestNumericBrush,
  indexFromBrushPixel,
  normalizeNumericBrushRange,
  panIndexBrush,
  panNumericBrush,
  resizeIndexBrush,
  resizeNumericBrush,
  valueFromBrushPixel,
  zoomIndexBrush,
  zoomNumericBrush,
} from "./brush-interactions";
import type { LinearMapper } from "./canvas-primitives";

function makeMapper(): LinearMapper {
  const fn = ((index: number) => 10 + index * 10) as LinearMapper;
  fn.inverse = (pixel: number) => (pixel - 10) / 10;
  return fn;
}

describe("brush interactions", () => {
  it("maps brush pixels to clamped rounded indices", () => {
    const map = makeMapper();

    expect(indexFromBrushPixel(map, 35, 10)).toBe(3);
    expect(indexFromBrushPixel(map, -100, 10)).toBe(0);
    expect(indexFromBrushPixel(map, 999, 10)).toBe(9);
  });

  it("hit-tests nearest travellers before brush body", () => {
    const map = makeMapper();
    const layout = { brushTop: 100, brushBottom: 130 };
    const range = { startIndex: 2, endIndex: 6 };

    expect(
      hitTestIndexBrush({
        x: 31,
        y: 110,
        layout,
        range,
        mapBrushX: map,
        travellerWidth: 8,
      }),
    ).toBe("left-traveller");
    expect(
      hitTestIndexBrush({
        x: 69,
        y: 110,
        layout,
        range,
        mapBrushX: map,
        travellerWidth: 8,
      }),
    ).toBe("right-traveller");
    expect(
      hitTestIndexBrush({
        x: 50,
        y: 110,
        layout,
        range,
        mapBrushX: map,
        travellerWidth: 8,
      }),
    ).toBe("brush-body");
    expect(
      hitTestIndexBrush({
        x: 50,
        y: 90,
        layout,
        range,
        mapBrushX: map,
        travellerWidth: 8,
      }),
    ).toBeNull();
  });

  it("resizes a range while preserving the minimum span", () => {
    expect(
      resizeIndexBrush({
        range: { startIndex: 1, endIndex: 8 },
        pointerIndex: 7,
        edge: "start",
        itemCount: 12,
        minSpan: 4,
      }),
    ).toEqual({ startIndex: 4, endIndex: 8 });

    expect(
      resizeIndexBrush({
        range: { startIndex: 1, endIndex: 8 },
        pointerIndex: 2,
        edge: "end",
        itemCount: 12,
        minSpan: 4,
      }),
    ).toEqual({ startIndex: 1, endIndex: 5 });
  });

  it("pans a range without changing its span", () => {
    expect(
      panIndexBrush({
        range: { startIndex: 3, endIndex: 7 },
        deltaIndex: 2,
        itemCount: 10,
      }),
    ).toEqual({ startIndex: 5, endIndex: 9 });

    expect(
      panIndexBrush({
        range: { startIndex: 3, endIndex: 7 },
        deltaIndex: -10,
        itemCount: 10,
      }),
    ).toEqual({ startIndex: 0, endIndex: 4 });
  });

  it("converts brush and chart pixel deltas to index deltas", () => {
    expect(
      brushDeltaIndexFromPixels({
        deltaX: 25,
        itemCount: 11,
        brushPixelWidth: 100,
      }),
    ).toBe(3);

    expect(
      chartDeltaIndexFromPixels({
        deltaX: 25,
        visibleSpan: 10,
        chartPixelWidth: 100,
      }),
    ).toBe(-2);
  });

  it("zooms index ranges symmetrically", () => {
    expect(
      zoomIndexBrush({
        range: { startIndex: 0, endIndex: 10 },
        itemCount: 20,
        deltaY: -1,
        minSpan: 4,
        zoomStep: 2,
      }),
    ).toEqual({ startIndex: 2, endIndex: 8 });

    expect(
      zoomIndexBrush({
        range: { startIndex: 2, endIndex: 8 },
        itemCount: 20,
        deltaY: 1,
        minSpan: 4,
        zoomStep: 2,
      }),
    ).toEqual({ startIndex: 0, endIndex: 10 });
  });

  it("maps brush pixels to clamped numeric values", () => {
    expect(
      valueFromBrushPixel({
        x: 50,
        brushLeft: 10,
        brushRight: 110,
        domain: { min: 0, max: 1_000 },
      }),
    ).toBe(400);
    expect(
      valueFromBrushPixel({
        x: -100,
        brushLeft: 10,
        brushRight: 110,
        domain: { min: 0, max: 1_000 },
      }),
    ).toBe(0);
    expect(
      valueFromBrushPixel({
        x: 200,
        brushLeft: 10,
        brushRight: 110,
        domain: { min: 0, max: 1_000 },
      }),
    ).toBe(1_000);
  });

  it("hit-tests numeric brush travellers and body", () => {
    const map = (value: number) => 10 + value / 10;
    const layout = {
      brushTop: 100,
      brushBottom: 130,
      brushLeft: 10,
      brushRight: 110,
    };
    const range = { start: 200, end: 600 };

    expect(
      hitTestNumericBrush({
        x: 31,
        y: 110,
        layout,
        range,
        mapBrushX: map,
        travellerWidth: 8,
      }),
    ).toBe("left-traveller");
    expect(
      hitTestNumericBrush({
        x: 69,
        y: 110,
        layout,
        range,
        mapBrushX: map,
        travellerWidth: 8,
      }),
    ).toBe("right-traveller");
    expect(
      hitTestNumericBrush({
        x: 50,
        y: 110,
        layout,
        range,
        mapBrushX: map,
        travellerWidth: 8,
      }),
    ).toBe("brush-body");
  });

  it("resizes, pans, and zooms numeric ranges", () => {
    const domain = { min: 0, max: 1_000 };

    expect(
      resizeNumericBrush({
        range: { start: 100, end: 800 },
        pointerValue: 700,
        edge: "start",
        domain,
        minSpan: 400,
      }),
    ).toEqual({ start: 400, end: 800 });

    expect(
      panNumericBrush({
        range: { start: 300, end: 700 },
        delta: 500,
        domain,
      }),
    ).toEqual({ start: 600, end: 1000 });

    expect(
      zoomNumericBrush({
        range: { start: 0, end: 1_000 },
        domain,
        deltaY: -1,
        minSpan: 100,
        zoomFraction: 0.2,
      }),
    ).toEqual({ start: 100, end: 900 });
  });

  it("normalizes and collapses numeric brush ranges", () => {
    const domain = { min: 0, max: 1_000 };

    expect(
      normalizeNumericBrushRange({
        range: { start: 800, end: 100 },
        domain,
        minSpan: 200,
      }),
    ).toEqual({ start: 100, end: 800 });

    expect(
      normalizeNumericBrushRange({
        range: { start: 100, end: 150 },
        domain,
        minSpan: 200,
      }),
    ).toBeNull();

    expect(
      collapseFullNumericBrushRange({
        range: { start: 0, end: 1_000 },
        domain,
      }),
    ).toBeNull();
  });

  it("converts brush pixel deltas to numeric deltas", () => {
    expect(
      brushDeltaValueFromPixels({
        deltaX: 25,
        brushPixelWidth: 100,
        domain: { min: 0, max: 1_000 },
      }),
    ).toBe(250);
  });
});
