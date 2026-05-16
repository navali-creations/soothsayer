import { describe, expect, it } from "vitest";

import { sanitizeStoreForDevtools } from "./store.utils";

interface DevtoolsState {
  appPerformance: {
    captureHistory: Array<{
      id: string;
      sparklineSamples: Array<{ id: number }>;
    }>;
    routeMarkers: Array<{ id: number }>;
    samples: Array<{ id: number }>;
  };
  other: string;
}

describe("sanitizeStoreForDevtools", () => {
  it("leaves unrelated state unchanged by reference", () => {
    const state = { other: "value" };

    expect(sanitizeStoreForDevtools(state)).toBe(state);
  });

  it("bounds app performance arrays in the devtools payload", () => {
    const state: DevtoolsState = {
      appPerformance: {
        captureHistory: Array.from({ length: 8 }, (_, id) => ({
          id: `capture-${id}`,
          sparklineSamples: Array.from({ length: 8 }, (__, sampleId) => ({
            id: sampleId,
          })),
        })),
        routeMarkers: Array.from({ length: 8 }, (_, id) => ({ id })),
        samples: Array.from({ length: 8 }, (_, id) => ({ id })),
      },
      other: "value",
    };

    const sanitized = sanitizeStoreForDevtools(state);

    expect(sanitized.other).toBe("value");
    expect(sanitized.appPerformance.samples.map((sample) => sample.id)).toEqual(
      [3, 4, 5, 6, 7],
    );
    expect(
      sanitized.appPerformance.routeMarkers.map((marker) => marker.id),
    ).toEqual([3, 4, 5, 6, 7]);
    expect(
      sanitized.appPerformance.captureHistory.map((capture) => capture.id),
    ).toEqual([
      "capture-3",
      "capture-4",
      "capture-5",
      "capture-6",
      "capture-7",
    ]);
    expect(
      sanitized.appPerformance.captureHistory[0].sparklineSamples.map(
        (sample) => sample.id,
      ),
    ).toEqual([3, 4, 5, 6, 7]);
    expect(state.appPerformance.samples).toHaveLength(8);
  });
});
