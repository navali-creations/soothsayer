import { renderWithProviders } from "~/renderer/__test-setup__/render";

import { LegendIcon } from "./LegendIcon";

describe("LegendIcon", () => {
  it("renders area icon with a path element", () => {
    const { container } = renderWithProviders(
      <LegendIcon visual="area" color="#ff0000" />,
    );

    const svg = container.querySelector("svg");
    const path = container.querySelector("path");

    expect(svg).toBeInTheDocument();
    expect(path).toBeInTheDocument();
  });

  it("renders scatter icon with circle elements", () => {
    const { container } = renderWithProviders(
      <LegendIcon visual="scatter" color="#00ff00" />,
    );

    const svg = container.querySelector("svg");
    const circles = container.querySelectorAll("circle");

    expect(svg).toBeInTheDocument();
    expect(circles.length).toBe(3);
  });

  it("renders bar icon with rect elements", () => {
    const { container } = renderWithProviders(
      <LegendIcon visual="bar" color="#00ff00" />,
    );

    const svg = container.querySelector("svg");
    const rects = container.querySelectorAll("rect");

    expect(svg).toBeInTheDocument();
    expect(rects.length).toBe(3);
  });

  it("renders line icon with a path element", () => {
    const { container } = renderWithProviders(
      <LegendIcon visual="line" color="#00ff00" />,
    );

    const svg = container.querySelector("svg");
    const path = container.querySelector("path");

    expect(svg).toBeInTheDocument();
    expect(path).toBeInTheDocument();
  });

  it("renders dashed-line icon with a line element", () => {
    const { container } = renderWithProviders(
      <LegendIcon visual="dashed-line" color="#00ff00" />,
    );

    const svg = container.querySelector("svg");
    const line = container.querySelector("line");

    expect(svg).toBeInTheDocument();
    expect(line).toBeInTheDocument();
  });

  it("renders zigzag-gap icon as a rotated wave icon", () => {
    const { container } = renderWithProviders(
      <LegendIcon visual="zigzag-gap" color="#00ff00" />,
    );

    const wrapper = container.querySelector(
      '[data-testid="legend-zigzag-gap-icon"]',
    );
    const svg = wrapper?.querySelector("svg");

    expect(wrapper).toBeInTheDocument();
    expect(svg).toBeInTheDocument();
  });

  it("applies color to area icon as fill and stroke", () => {
    const color = "#ff6600";
    const { container } = renderWithProviders(
      <LegendIcon visual="area" color={color} />,
    );

    const path = container.querySelector("path");

    expect(path).toHaveAttribute("fill", color);
    expect(path).toHaveAttribute("stroke", color);
  });

  it("applies color to scatter icon circles as fill", () => {
    const color = "#3366cc";
    const { container } = renderWithProviders(
      <LegendIcon visual="scatter" color={color} />,
    );

    const circles = container.querySelectorAll("circle");

    for (const circle of circles) {
      expect(circle).toHaveAttribute("fill", color);
    }
  });

  it("applies color to line icon stroke", () => {
    const color = "#6633cc";
    const { container } = renderWithProviders(
      <LegendIcon visual="line" color={color} />,
    );

    const path = container.querySelector("path");
    expect(path).toHaveAttribute("stroke", color);
  });

  it("applies color to dashed-line icon stroke", () => {
    const color = "#66cc33";
    const { container } = renderWithProviders(
      <LegendIcon visual="dashed-line" color={color} />,
    );

    const line = container.querySelector("line");
    expect(line).toHaveAttribute("stroke", color);
  });

  it("applies color and rotation to zigzag-gap icon wrapper", () => {
    const color = "#22ddaa";
    const { container } = renderWithProviders(
      <LegendIcon visual="zigzag-gap" color={color} />,
    );

    const wrapper = container.querySelector(
      '[data-testid="legend-zigzag-gap-icon"]',
    );
    expect(wrapper).toHaveStyle({ color });
    expect(wrapper).toHaveStyle({ transform: "rotate(90deg)" });
  });

  it("has correct dimensions (width=12, height=12)", () => {
    const { container: areaContainer } = renderWithProviders(
      <LegendIcon visual="area" color="#000" />,
    );

    const areaSvg = areaContainer.querySelector("svg");
    expect(areaSvg).toHaveAttribute("width", "12");
    expect(areaSvg).toHaveAttribute("height", "12");

    const { container: scatterContainer } = renderWithProviders(
      <LegendIcon visual="scatter" color="#000" />,
    );

    const scatterSvg = scatterContainer.querySelector("svg");
    expect(scatterSvg).toHaveAttribute("width", "12");
    expect(scatterSvg).toHaveAttribute("height", "12");
  });
});
