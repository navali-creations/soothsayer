import { render, screen } from "@testing-library/react";

import type { LinePoint } from "~/renderer/modules/current-session/CurrentSession.components/SessionProfitTimeline/types/types";

import StaticProfitSparkline from "./StaticProfitSparkline";

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

describe("StaticProfitSparkline", () => {
  const emptyLinePoints: LinePoint[] = [];

  const singleLinePoint: LinePoint[] = [{ x: 0, profit: 10 }];

  const multipleLinePoints: LinePoint[] = [
    { x: 0, profit: 0 },
    { x: 1, profit: 5 },
    { x: 2, profit: -3 },
    { x: 3, profit: 12 },
    { x: 4, profit: 8 },
  ];

  it("should render a canvas element", () => {
    render(<StaticProfitSparkline linePoints={multipleLinePoints} />);
    const canvas = screen.getByTestId("static-profit-sparkline");
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe("CANVAS");
  });

  it("should apply provided className", () => {
    const { container } = render(
      <StaticProfitSparkline
        linePoints={multipleLinePoints}
        className="my-sparkline-class"
      />,
    );
    // The className is applied to the outer container div
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("my-sparkline-class");
  });

  it("should apply default height when not specified", () => {
    const { container } = render(
      <StaticProfitSparkline linePoints={multipleLinePoints} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    // When height is not provided, the component sets height to "100%"
    expect(wrapper.style.height).toBe("100%");
  });

  it("should apply custom height prop", () => {
    const { container } = render(
      <StaticProfitSparkline linePoints={multipleLinePoints} height={60} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.height).toBe("60px");
  });

  it("should render with empty linePoints", () => {
    render(<StaticProfitSparkline linePoints={emptyLinePoints} />);
    const canvas = screen.getByTestId("static-profit-sparkline");
    expect(canvas).toBeInTheDocument();
  });

  it("should render with single linePoint", () => {
    render(<StaticProfitSparkline linePoints={singleLinePoint} />);
    const canvas = screen.getByTestId("static-profit-sparkline");
    expect(canvas).toBeInTheDocument();
  });

  it("should render with multiple linePoints", () => {
    render(<StaticProfitSparkline linePoints={multipleLinePoints} />);
    const canvas = screen.getByTestId("static-profit-sparkline");
    expect(canvas).toBeInTheDocument();
  });

  it("should accept custom lineColor prop", () => {
    // Verify the component renders without errors when a custom lineColor is passed.
    // The actual canvas drawing won't happen in jsdom (getContext returns null),
    // but the component should not throw.
    render(
      <StaticProfitSparkline
        linePoints={multipleLinePoints}
        lineColor="rgba(255, 0, 0, 0.8)"
      />,
    );
    const canvas = screen.getByTestId("static-profit-sparkline");
    expect(canvas).toBeInTheDocument();
  });

  it("should set positioning styles on the container", () => {
    const { container } = render(
      <StaticProfitSparkline linePoints={multipleLinePoints} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe("relative");
    expect(wrapper.style.overflow).toBe("hidden");
  });

  it("should set positioning styles on the canvas", () => {
    render(<StaticProfitSparkline linePoints={multipleLinePoints} />);
    const canvas = screen.getByTestId(
      "static-profit-sparkline",
    ) as HTMLCanvasElement;
    expect(canvas.style.position).toBe("absolute");
    expect(canvas.style.top).toBe("0px");
    expect(canvas.style.left).toBe("0px");
    expect(canvas.style.width).toBe("100%");
    expect(canvas.style.height).toBe("100%");
    expect(canvas.style.pointerEvents).toBe("none");
  });
});
