import { describe, expect, it } from "vitest";

import {
  brushDeltaIndexFromPixels,
  chartDeltaIndexFromPixels,
  hitTestIndexBrush,
  indexFromBrushPixel,
  panIndexBrush,
  resizeIndexBrush,
  zoomIndexBrush,
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
});
