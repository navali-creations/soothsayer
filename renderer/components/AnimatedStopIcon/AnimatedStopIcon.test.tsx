import { renderWithProviders } from "~/renderer/__test-setup__/render";

import { AnimatedStopIcon } from "./AnimatedStopIcon";

describe("AnimatedStopIcon", () => {
  it("renders the animated stop SVG with a default size", () => {
    const { container } = renderWithProviders(<AnimatedStopIcon />);

    const svg = container.querySelector("svg");
    const rect = container.querySelector("rect");

    expect(svg).toHaveClass("w-4", "h-4");
    expect(rect).toHaveAttribute("pathLength", "100");
    expect(rect).toHaveClass("animate-stop-session");
  });

  it("accepts a custom class name", () => {
    const { container } = renderWithProviders(
      <AnimatedStopIcon className="h-6 w-6" />,
    );

    expect(container.querySelector("svg")).toHaveClass("h-6", "w-6");
  });
});
