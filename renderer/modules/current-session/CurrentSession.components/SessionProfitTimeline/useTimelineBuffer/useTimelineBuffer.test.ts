import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AggregatedTimeline } from "~/types/data-stores";

// ─── Mock the timelineBuffer singleton ──────────────────────────────────────

const mockTimelineBuffer = vi.hoisted(() => ({
  save: vi.fn(),
  restore: vi.fn(),
  seedFromTimeline: vi.fn(),
  setDeckCost: vi.fn(),
  subscribe: vi.fn((_cb: () => void) => vi.fn() as () => void),
  _version: 0,
  get version() {
    return this._version;
  },
}));

vi.mock(
  "~/renderer/modules/current-session/CurrentSession.components/SessionProfitTimeline/timeline-buffer/timeline-buffer",
  () => ({
    timelineBuffer: mockTimelineBuffer,
  }),
);

import { useTimelineBuffer } from "./useTimelineBuffer";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTimeline(
  overrides: Partial<AggregatedTimeline> = {},
): AggregatedTimeline {
  return {
    buckets: [],
    liveEdge: [],
    totalChaosValue: 0,
    totalDivineValue: 0,
    totalDrops: 0,
    notableDrops: [],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useTimelineBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTimelineBuffer._version = 0;
    mockTimelineBuffer.subscribe.mockImplementation(() => vi.fn());
  });

  // ── 1. Calls setDeckCost on mount with initial deckCost value ───────────

  it("should call setDeckCost on mount with initial deckCost value", () => {
    renderHook(() => useTimelineBuffer({ deckCost: 42 }));

    expect(mockTimelineBuffer.setDeckCost).toHaveBeenCalledTimes(1);
    expect(mockTimelineBuffer.setDeckCost).toHaveBeenCalledWith(42);
  });

  // ── 2. Calls setDeckCost when deckCost prop changes ─────────────────────

  it("should call setDeckCost when deckCost prop changes", () => {
    const { rerender } = renderHook(
      ({ deckCost }) => useTimelineBuffer({ deckCost }),
      { initialProps: { deckCost: 10 } },
    );

    expect(mockTimelineBuffer.setDeckCost).toHaveBeenCalledWith(10);

    rerender({ deckCost: 25 });

    expect(mockTimelineBuffer.setDeckCost).toHaveBeenCalledTimes(2);
    expect(mockTimelineBuffer.setDeckCost).toHaveBeenLastCalledWith(25);
  });

  // ── 3. When timeline prop is provided, calls save() then seedFromTimeline

  it("should call save() then seedFromTimeline(timeline) when timeline prop is provided", () => {
    const timeline = makeTimeline({ totalDrops: 5 });

    renderHook(() => useTimelineBuffer({ timeline, deckCost: 0 }));

    expect(mockTimelineBuffer.save).toHaveBeenCalledTimes(1);
    expect(mockTimelineBuffer.seedFromTimeline).toHaveBeenCalledTimes(1);
    expect(mockTimelineBuffer.seedFromTimeline).toHaveBeenCalledWith(timeline);

    // save must be called before seedFromTimeline
    const saveOrder = mockTimelineBuffer.save.mock.invocationCallOrder[0];
    const seedOrder =
      mockTimelineBuffer.seedFromTimeline.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(seedOrder);
  });

  // ── 4. On unmount (when timeline was seeded), calls restore() ───────────

  it("should call restore() on unmount when timeline was seeded", () => {
    const timeline = makeTimeline({ totalDrops: 3 });

    const { unmount } = renderHook(() =>
      useTimelineBuffer({ timeline, deckCost: 0 }),
    );

    expect(mockTimelineBuffer.restore).not.toHaveBeenCalled();

    unmount();

    expect(mockTimelineBuffer.restore).toHaveBeenCalledTimes(1);
  });

  // ── 5. Does NOT call save/seed if timeline prop is null ─────────────────

  it("should not call save or seedFromTimeline if timeline prop is null", () => {
    renderHook(() => useTimelineBuffer({ timeline: null, deckCost: 0 }));

    expect(mockTimelineBuffer.save).not.toHaveBeenCalled();
    expect(mockTimelineBuffer.seedFromTimeline).not.toHaveBeenCalled();
  });

  it("should not call save or seedFromTimeline if timeline prop is undefined", () => {
    renderHook(() => useTimelineBuffer({ deckCost: 0 }));

    expect(mockTimelineBuffer.save).not.toHaveBeenCalled();
    expect(mockTimelineBuffer.seedFromTimeline).not.toHaveBeenCalled();
  });

  it("should not call restore on unmount when timeline was never seeded", () => {
    const { unmount } = renderHook(() =>
      useTimelineBuffer({ timeline: null, deckCost: 0 }),
    );

    unmount();

    expect(mockTimelineBuffer.restore).not.toHaveBeenCalled();
  });

  // ── 6. Returns bufferVersion from useSyncExternalStore ──────────────────

  it("should return bufferVersion from the buffer's version getter", () => {
    mockTimelineBuffer._version = 10;

    const { result } = renderHook(() => useTimelineBuffer({ deckCost: 0 }));

    expect(result.current).toBe(mockTimelineBuffer._version);
  });

  it("should return 0 when version is 0", () => {
    mockTimelineBuffer._version = 0;

    const { result } = renderHook(() => useTimelineBuffer({ deckCost: 0 }));

    expect(result.current).toBe(0);
  });

  it("should re-render when the subscribe callback is invoked", () => {
    let subscribeCb: (() => void) | undefined;
    mockTimelineBuffer.subscribe.mockImplementation((cb: any) => {
      subscribeCb = cb;
      return vi.fn();
    });

    mockTimelineBuffer._version = 0;

    const { result } = renderHook(() => useTimelineBuffer({ deckCost: 0 }));

    expect(result.current).toBe(0);

    // Simulate buffer update
    mockTimelineBuffer._version = 7;

    act(() => {
      subscribeCb?.();
    });

    expect(result.current).toBe(mockTimelineBuffer._version);
  });

  // ── 7. When timeline prop changes to a new reference, saves and re-seeds

  it("should save and re-seed when timeline prop changes to a new reference", () => {
    const timeline1 = makeTimeline({ totalDrops: 2 });
    const timeline2 = makeTimeline({ totalDrops: 5 });

    const { rerender } = renderHook(
      ({ timeline }) => useTimelineBuffer({ timeline, deckCost: 0 }),
      { initialProps: { timeline: timeline1 as AggregatedTimeline | null } },
    );

    expect(mockTimelineBuffer.save).toHaveBeenCalledTimes(1);
    expect(mockTimelineBuffer.seedFromTimeline).toHaveBeenCalledTimes(1);
    expect(mockTimelineBuffer.seedFromTimeline).toHaveBeenCalledWith(timeline1);

    vi.clearAllMocks();

    rerender({ timeline: timeline2 });

    expect(mockTimelineBuffer.save).toHaveBeenCalledTimes(1);
    expect(mockTimelineBuffer.seedFromTimeline).toHaveBeenCalledTimes(1);
    expect(mockTimelineBuffer.seedFromTimeline).toHaveBeenCalledWith(timeline2);
  });

  // ── 8. Does not re-seed if timeline prop reference is the same ──────────

  it("should not re-seed if timeline prop reference is the same", () => {
    const timeline = makeTimeline({ totalDrops: 3 });

    const { rerender } = renderHook(
      ({ timeline }) => useTimelineBuffer({ timeline, deckCost: 0 }),
      { initialProps: { timeline } },
    );

    expect(mockTimelineBuffer.save).toHaveBeenCalledTimes(1);
    expect(mockTimelineBuffer.seedFromTimeline).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    // Re-render with the exact same reference
    rerender({ timeline });

    expect(mockTimelineBuffer.save).not.toHaveBeenCalled();
    expect(mockTimelineBuffer.seedFromTimeline).not.toHaveBeenCalled();
  });

  it("should not re-seed when only deckCost changes and timeline stays the same", () => {
    const timeline = makeTimeline({ totalDrops: 3 });

    const { rerender } = renderHook(
      ({ timeline, deckCost }) => useTimelineBuffer({ timeline, deckCost }),
      { initialProps: { timeline, deckCost: 10 } },
    );

    vi.clearAllMocks();

    rerender({ timeline, deckCost: 20 });

    expect(mockTimelineBuffer.save).not.toHaveBeenCalled();
    expect(mockTimelineBuffer.seedFromTimeline).not.toHaveBeenCalled();
    expect(mockTimelineBuffer.setDeckCost).toHaveBeenCalledWith(20);
  });
});
