import { cleanup, render } from "@testing-library/react";
import { type Mock, vi } from "vitest";

// ── Mocks (must be declared before component import) ────────────────────────

vi.mock("../timeline-buffer/timeline-buffer", () => ({
  timelineBuffer: {
    linePoints: [] as { x: number; profit: number }[],
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock("~/renderer/lib/canvas-core", () => ({
  useCanvasResize: vi.fn(() => ({
    containerRef: { current: null },
    canvasRef: { current: null },
    canvasSize: { width: 200, height: 40 },
  })),
  clamp: (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max),
  DPR: () => 1,
  drawMonotoneCurve: vi.fn(),
  setupCanvas: vi.fn(),
  evenTicks: vi.fn(() => []),
  monotoneTangents: vi.fn(() => []),
  parseRgba: vi.fn(() => ({ r: 128, g: 128, b: 128, a: 1 })),
  rgbaStr: vi.fn(() => "rgba(128, 128, 128, 1)"),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { timelineBuffer } from "../timeline-buffer/timeline-buffer";
import MiniProfitSparkline from "./MiniProfitSparkline";

const mockBuffer = vi.mocked(timelineBuffer);

// ── Tests ───────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MiniProfitSparkline", () => {
  it("should render a canvas element", () => {
    render(<MiniProfitSparkline />);
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should subscribe to timelineBuffer on mount", () => {
    render(<MiniProfitSparkline />);
    expect(mockBuffer.subscribe).toHaveBeenCalledTimes(1);
    expect(mockBuffer.subscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should unsubscribe from timelineBuffer on unmount", () => {
    const unsubscribe = vi.fn();
    (mockBuffer.subscribe as Mock).mockReturnValue(unsubscribe);

    const { unmount } = render(<MiniProfitSparkline />);
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("should render without errors when buffer has no data", () => {
    mockBuffer.linePoints = [];
    expect(() => render(<MiniProfitSparkline />)).not.toThrow();

    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should render without errors when buffer has data", () => {
    mockBuffer.linePoints = [
      { x: 0, profit: 0 },
      { x: 1, profit: 10 },
      { x: 2, profit: -5 },
      { x: 3, profit: 20 },
    ];
    expect(() => render(<MiniProfitSparkline />)).not.toThrow();

    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should apply provided className", () => {
    const { container } = render(
      <MiniProfitSparkline className="my-sparkline" />,
    );
    // The className is applied to the outer container div
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("my-sparkline");
  });

  it("should apply default height of 100% when height prop is not specified", () => {
    const { container } = render(<MiniProfitSparkline />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.height).toBe("100%");
  });

  it("should apply explicit height when height prop is provided", () => {
    const { container } = render(<MiniProfitSparkline height={60} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.height).toBe("60px");
  });

  it("should have correct inline styles on the container div", () => {
    const { container } = render(<MiniProfitSparkline />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe("relative");
    expect(wrapper.style.overflow).toBe("hidden");
  });

  it("should have correct inline styles on the canvas element", () => {
    const { container } = render(<MiniProfitSparkline />);
    const canvasEl = container.querySelector("canvas");
    expect(canvasEl).toBeInTheDocument();
    if (canvasEl) {
      expect(canvasEl.style.position).toBe("absolute");
      expect(canvasEl.style.pointerEvents).toBe("none");
      expect(canvasEl.style.width).toBe("100%");
      expect(canvasEl.style.height).toBe("100%");
    }
  });
});
