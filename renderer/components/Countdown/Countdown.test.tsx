import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import Countdown from "./Countdown";

describe("Countdown", () => {
  const baseTimer = { hours: 0, minutes: 12, seconds: 45 };

  it("renders minutes and seconds when hours=0", () => {
    renderWithProviders(<Countdown timer={baseTimer} />);

    // Should have min and sec segments (each uses a countdown span)
    const segments = document.querySelectorAll(".countdown");
    // hours=0 and alwaysShowHours=false → only minutes + seconds = 2 segments
    expect(segments).toHaveLength(2);
  });

  it("does not show hours segment when hours=0 and alwaysShowHours=false", () => {
    renderWithProviders(
      <Countdown timer={{ hours: 0, minutes: 5, seconds: 30 }} />,
    );

    // There should be exactly 2 countdown segments (min + sec), not 3
    const segments = document.querySelectorAll(".countdown");
    expect(segments).toHaveLength(2);
  });

  it("shows hours segment when hours > 0", () => {
    renderWithProviders(
      <Countdown timer={{ hours: 2, minutes: 5, seconds: 30 }} />,
    );

    const segments = document.querySelectorAll(".countdown");
    expect(segments).toHaveLength(3);
  });

  it("shows hours segment when alwaysShowHours=true even if hours=0", () => {
    renderWithProviders(
      <Countdown
        timer={{ hours: 0, minutes: 5, seconds: 30 }}
        alwaysShowHours
      />,
    );

    const segments = document.querySelectorAll(".countdown");
    expect(segments).toHaveLength(3);
  });

  it("shows labels when showLabels=true", () => {
    renderWithProviders(
      <Countdown
        timer={{ hours: 1, minutes: 5, seconds: 30 }}
        showLabels
        alwaysShowHours
      />,
    );

    expect(screen.getByText("hrs")).toBeInTheDocument();
    expect(screen.getByText("min")).toBeInTheDocument();
    expect(screen.getByText("sec")).toBeInTheDocument();
  });

  it("does not show labels when showLabels=false", () => {
    renderWithProviders(
      <Countdown
        timer={{ hours: 1, minutes: 5, seconds: 30 }}
        showLabels={false}
        alwaysShowHours
      />,
    );

    expect(screen.queryByText("hrs")).not.toBeInTheDocument();
    expect(screen.queryByText("min")).not.toBeInTheDocument();
    expect(screen.queryByText("sec")).not.toBeInTheDocument();
  });

  it("sets correct --value CSS variable on each segment", () => {
    renderWithProviders(
      <Countdown
        timer={{ hours: 3, minutes: 15, seconds: 42 }}
        alwaysShowHours
      />,
    );

    // Each segment's inner span has the --value CSS variable
    const valueSpans = document.querySelectorAll(".countdown > span");
    expect(valueSpans).toHaveLength(3);

    expect(
      (valueSpans[0] as HTMLElement).style.getPropertyValue("--value"),
    ).toBe("3");
    expect(
      (valueSpans[1] as HTMLElement).style.getPropertyValue("--value"),
    ).toBe("15");
    expect(
      (valueSpans[2] as HTMLElement).style.getPropertyValue("--value"),
    ).toBe("42");
  });

  it("renders separators between segments", () => {
    renderWithProviders(
      <Countdown
        timer={{ hours: 1, minutes: 5, seconds: 30 }}
        alwaysShowHours
      />,
    );

    // With 3 segments there should be 2 separators (`:`)
    const separators = screen.getAllByText(":");
    expect(separators).toHaveLength(2);
  });

  it("applies 'relative' class instead of 'gap-0.5' when labelPosition is 'absolute'", () => {
    renderWithProviders(
      <Countdown
        timer={{ hours: 1, minutes: 5, seconds: 30 }}
        showLabels
        labelPosition="absolute"
        alwaysShowHours
      />,
    );

    // The segment wrapper divs should have "relative" class (not "gap-0.5")
    const segmentWrappers = document.querySelectorAll(
      ".flex.flex-col.items-center",
    );
    for (const wrapper of segmentWrappers) {
      expect(wrapper).toHaveClass("relative");
      expect(wrapper).not.toHaveClass("gap-0.5");
    }

    // Labels should have absolute positioning classes
    const label = screen.getByText("hrs");
    expect(label).toHaveClass("absolute");
    expect(label).toHaveClass("top-full");
    expect(label).toHaveClass("left-1/2");
    expect(label).toHaveClass("-translate-x-1/2");
    expect(label).toHaveClass("mt-0.5");
  });

  it("applies custom className to outer span", () => {
    const { container } = renderWithProviders(
      <Countdown timer={baseTimer} className="my-custom-class" />,
    );

    // The outermost element is a <span>
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.tagName).toBe("SPAN");
    expect(outer).toHaveClass("my-custom-class");
  });

  it("applies the correct size class", () => {
    renderWithProviders(<Countdown timer={baseTimer} size="lg" />);

    const countdownSpans = document.querySelectorAll(".countdown");
    for (const span of countdownSpans) {
      expect(span).toHaveClass("text-lg");
    }
  });
});
