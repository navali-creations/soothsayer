import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../TimelineTooltip/TimelineTooltip", () => ({
  computePortalTooltipStyle: vi.fn(() => ({ display: "none" })),
}));

import { computePortalTooltipStyle } from "../TimelineTooltip/TimelineTooltip";
import { useTimelineTooltip } from "./useTimelineTooltip";

const mockComputePortalTooltipStyle = vi.mocked(computePortalTooltipStyle);

function createMockContainerRef(
  el: HTMLDivElement | null = null,
): RefObject<HTMLDivElement | null> {
  return { current: el };
}

function createMockDivElement(rect: Partial<DOMRect> = {}): HTMLDivElement {
  const div = document.createElement("div");
  div.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: 0,
    width: 800,
    height: 400,
    top: 0,
    right: 800,
    bottom: 400,
    left: 0,
    toJSON: () => {},
    ...rect,
  }));
  return div;
}

describe("useTimelineTooltip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputePortalTooltipStyle.mockReturnValue({ display: "none" });
  });

  it("should return initial tooltip state as { visible: false, x: 0, y: 0, point: null }", () => {
    const containerRef = createMockContainerRef();
    const { result } = renderHook(() => useTimelineTooltip(containerRef));

    expect(result.current.tooltip).toEqual({
      visible: false,
      x: 0,
      y: 0,
      point: null,
    });
  });

  it("should return initial tooltipStyle as { display: 'none' } from mocked computePortalTooltipStyle", () => {
    const containerRef = createMockContainerRef();
    const { result } = renderHook(() => useTimelineTooltip(containerRef));

    expect(result.current.tooltipStyle).toEqual({ display: "none" });
  });

  it("should update tooltip state when setTooltip is called", () => {
    const containerRef = createMockContainerRef();
    const { result } = renderHook(() => useTimelineTooltip(containerRef));

    const newTooltip = {
      visible: true,
      x: 150,
      y: 200,
      point: {
        x: 5,
        profit: 100,
        barValue: 50,
        cardName: "The Doctor",
        rarity: 3 as const,
      },
    };

    act(() => {
      result.current.setTooltip(newTooltip);
    });

    expect(result.current.tooltip).toEqual(newTooltip);
  });

  it("should NOT call getBoundingClientRect when tooltip is not visible", () => {
    const div = createMockDivElement();
    const containerRef = createMockContainerRef(div);

    renderHook(() => useTimelineTooltip(containerRef));

    expect(div.getBoundingClientRect).not.toHaveBeenCalled();
  });

  it("should call getBoundingClientRect when tooltip is visible and containerElRef has an element", () => {
    const div = createMockDivElement({
      top: 10,
      left: 20,
      width: 800,
      height: 400,
    });
    const containerRef = createMockContainerRef(div);

    const { result } = renderHook(() => useTimelineTooltip(containerRef));

    act(() => {
      result.current.setTooltip({
        visible: true,
        x: 100,
        y: 200,
        point: {
          x: 3,
          profit: 50,
          barValue: null,
          cardName: null,
          rarity: null,
        },
      });
    });

    expect(div.getBoundingClientRect).toHaveBeenCalled();
  });

  it("should call computePortalTooltipStyle with tooltip state and containerRect", () => {
    const domRect = {
      x: 0,
      y: 0,
      width: 800,
      height: 400,
      top: 10,
      right: 820,
      bottom: 410,
      left: 20,
      toJSON: expect.any(Function),
    };
    const div = createMockDivElement(domRect);
    const containerRef = createMockContainerRef(div);

    const { result } = renderHook(() => useTimelineTooltip(containerRef));

    mockComputePortalTooltipStyle.mockClear();

    const tooltipState = {
      visible: true,
      x: 100,
      y: 200,
      point: {
        x: 3,
        profit: 50,
        barValue: null,
        cardName: null,
        rarity: null,
      },
    };

    act(() => {
      result.current.setTooltip(tooltipState);
    });

    expect(mockComputePortalTooltipStyle).toHaveBeenCalledWith(
      tooltipState,
      expect.objectContaining({
        top: 10,
        left: 20,
        width: 800,
        height: 400,
      }),
    );
  });

  it("should call computePortalTooltipStyle with null containerRect when tooltip is not visible", () => {
    const div = createMockDivElement();
    const containerRef = createMockContainerRef(div);

    renderHook(() => useTimelineTooltip(containerRef));

    expect(mockComputePortalTooltipStyle).toHaveBeenCalledWith(
      { visible: false, x: 0, y: 0, point: null },
      null,
    );
  });
});
