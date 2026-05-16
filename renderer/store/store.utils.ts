import type { BoundStore } from "./store.types";

const DEVTOOLS_APP_PERFORMANCE_SAMPLE_LIMIT = 5;
const DEVTOOLS_APP_PERFORMANCE_MARKER_LIMIT = 5;
const DEVTOOLS_APP_PERFORMANCE_HISTORY_LIMIT = 5;
const DEVTOOLS_APP_PERFORMANCE_SPARKLINE_LIMIT = 5;

export function sanitizeStoreForDevtools<TState>(state: TState): TState {
  if (!isRecord(state)) return state;

  const appPerformance = (state as Partial<BoundStore>).appPerformance;
  if (!appPerformance) return state;

  return {
    ...state,
    appPerformance: {
      ...appPerformance,
      captureHistory: takeTail(
        appPerformance.captureHistory,
        DEVTOOLS_APP_PERFORMANCE_HISTORY_LIMIT,
      ).map((capture) => ({
        ...capture,
        sparklineSamples: takeTail(
          capture.sparklineSamples,
          DEVTOOLS_APP_PERFORMANCE_SPARKLINE_LIMIT,
        ),
      })),
      routeMarkers: takeTail(
        appPerformance.routeMarkers,
        DEVTOOLS_APP_PERFORMANCE_MARKER_LIMIT,
      ),
      samples: takeTail(
        appPerformance.samples,
        DEVTOOLS_APP_PERFORMANCE_SAMPLE_LIMIT,
      ),
    },
  } as TState;
}

function takeTail<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  return items.slice(-limit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
