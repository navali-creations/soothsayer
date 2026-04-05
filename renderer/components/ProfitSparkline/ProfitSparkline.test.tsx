import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LinePoint } from "~/renderer/modules/current-session/CurrentSession.components/SessionProfitTimeline/types/types";

import ProfitSparkline, { type SparklineDataSource } from "./ProfitSparkline";

// Mock canvas-core (useCanvasResize + canvas utils) since ResizeObserver
// and canvas operations are not available in jsdom
vi.mock("~/renderer/lib/canvas-core", () => ({
  useCanvasResize: vi.fn(() => ({
    containerRef: vi.fn(),
    containerElRef: { current: null },
    canvasRef: { current: null },
    canvasSize: { width: 200, height: 40 },
  })),
  setupCanvas: vi.fn(() => null),
  clamp: (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max),
  DPR: () => 1,
  drawMonotoneCurve: vi.fn(),
}));

const createMockDataSource = (): SparklineDataSource & {
  subscribe: ReturnType<typeof vi.fn>;
} => {
  const listeners = new Set<() => void>();
  return {
    linePoints: [
      { x: 0, profit: 0 },
      { x: 1, profit: 5 },
    ],
    subscribe: vi.fn((cb: () => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    }),
  };
};

describe("ProfitSparkline", () => {
  const TEST_ID = "profit-sparkline";

  const emptyLinePoints: LinePoint[] = [];

  const multipleLinePoints: LinePoint[] = [
    { x: 0, profit: 0 },
    { x: 1, profit: 5 },
    { x: 2, profit: -3 },
    { x: 3, profit: 12 },
    { x: 4, profit: 8 },
  ];

  it("should render a canvas element with the provided testId", () => {
    render(
      <ProfitSparkline linePoints={multipleLinePoints} testId={TEST_ID} />,
    );
    const canvas = screen.getByTestId(TEST_ID);
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe("CANVAS");
  });

  it("should apply provided className to the container div", () => {
    const { container } = render(
      <ProfitSparkline
        linePoints={multipleLinePoints}
        testId={TEST_ID}
        className="my-sparkline-class"
      />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("my-sparkline-class");
  });

  it("should use 100% height when height prop is not provided", () => {
    const { container } = render(
      <ProfitSparkline linePoints={multipleLinePoints} testId={TEST_ID} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.height).toBe("100%");
  });

  it("should use pixel height when height prop is provided", () => {
    const { container } = render(
      <ProfitSparkline
        linePoints={multipleLinePoints}
        testId={TEST_ID}
        height={60}
      />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.height).toBe("60px");
  });

  it("should render with empty linePoints without crashing", () => {
    render(<ProfitSparkline linePoints={emptyLinePoints} testId={TEST_ID} />);
    const canvas = screen.getByTestId(TEST_ID);
    expect(canvas).toBeInTheDocument();
  });

  it("should render with multiple linePoints without crashing", () => {
    render(
      <ProfitSparkline linePoints={multipleLinePoints} testId={TEST_ID} />,
    );
    const canvas = screen.getByTestId(TEST_ID);
    expect(canvas).toBeInTheDocument();
  });

  it("should set positioning styles on the container", () => {
    const { container } = render(
      <ProfitSparkline linePoints={multipleLinePoints} testId={TEST_ID} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe("relative");
    expect(wrapper.style.overflow).toBe("hidden");
  });

  it("should set positioning styles on the canvas", () => {
    render(
      <ProfitSparkline linePoints={multipleLinePoints} testId={TEST_ID} />,
    );
    const canvas = screen.getByTestId(TEST_ID) as HTMLCanvasElement;
    expect(canvas.style.position).toBe("absolute");
    expect(canvas.style.top).toBe("0px");
    expect(canvas.style.left).toBe("0px");
    expect(canvas.style.width).toBe("100%");
    expect(canvas.style.height).toBe("100%");
    expect(canvas.style.pointerEvents).toBe("none");
  });

  describe("live mode (dataSource)", () => {
    it("should subscribe to the data source", () => {
      const mockDataSource = createMockDataSource();
      render(<ProfitSparkline dataSource={mockDataSource} testId={TEST_ID} />);
      expect(mockDataSource.subscribe).toHaveBeenCalledTimes(1);
      expect(mockDataSource.subscribe).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("should unsubscribe on unmount", () => {
      const mockDataSource = createMockDataSource();
      render(<ProfitSparkline dataSource={mockDataSource} testId={TEST_ID} />);

      // Grab the unsubscribe function returned by subscribe
      const unsubscribe = mockDataSource.subscribe.mock.results[0].value;
      // Wrap it to spy on calls
      const unsubSpy = vi.fn(unsubscribe);

      // Re-render with a data source whose subscribe returns our spy
      const spiedDataSource: SparklineDataSource = {
        linePoints: mockDataSource.linePoints,
        subscribe: vi.fn((_cb: () => void) => {
          return unsubSpy;
        }),
      };

      const { unmount: unmount2 } = render(
        <ProfitSparkline dataSource={spiedDataSource} testId={TEST_ID} />,
      );

      expect(unsubSpy).not.toHaveBeenCalled();
      unmount2();
      expect(unsubSpy).toHaveBeenCalled();
    });
  });

  it("should accept custom lineColor without throwing", () => {
    render(
      <ProfitSparkline
        linePoints={multipleLinePoints}
        testId={TEST_ID}
        lineColor="rgba(255, 0, 0, 0.8)"
      />,
    );
    const canvas = screen.getByTestId(TEST_ID);
    expect(canvas).toBeInTheDocument();
  });
});
