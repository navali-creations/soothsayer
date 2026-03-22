import { renderWithProviders } from "~/renderer/__test-setup__/render";

import AnimatedNumber from "../AnimatedNumber";

describe("AnimatedNumber", () => {
  it("renders a span element", () => {
    const { container } = renderWithProviders(<AnimatedNumber value={42} />);
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
  });

  it('has base class "animated-number"', () => {
    const { container } = renderWithProviders(<AnimatedNumber value={10} />);
    const span = container.querySelector("span")!;
    expect(span).toHaveClass("animated-number");
  });

  it("applies decimals class for decimals=0", () => {
    const { container } = renderWithProviders(
      <AnimatedNumber value={5} decimals={0} />,
    );
    const span = container.querySelector("span")!;
    expect(span).toHaveClass("animated-number--decimals-0");
  });

  it("applies decimals class for decimals=2", () => {
    const { container } = renderWithProviders(
      <AnimatedNumber value={3.14} decimals={2} />,
    );
    const span = container.querySelector("span")!;
    expect(span).toHaveClass("animated-number--decimals-2");
  });

  it("appends custom className", () => {
    const { container } = renderWithProviders(
      <AnimatedNumber value={1} className="my-custom-class" />,
    );
    const span = container.querySelector("span")!;
    expect(span).toHaveClass("animated-number");
    expect(span).toHaveClass("my-custom-class");
  });

  it("sets --target-value CSS variable to the absolute value", () => {
    const { container } = renderWithProviders(<AnimatedNumber value={-99} />);
    const span = container.querySelector("span")!;
    expect(span.style.getPropertyValue("--target-value")).toBe("99");
  });

  it("sets --animation-duration CSS variable correctly", () => {
    const { container } = renderWithProviders(
      <AnimatedNumber value={10} duration={1.5} />,
    );
    const span = container.querySelector("span")!;
    expect(span.style.getPropertyValue("--animation-duration")).toBe("1.5s");
  });

  it("sets data-suffix correctly", () => {
    const { container } = renderWithProviders(
      <AnimatedNumber value={50} suffix="%" />,
    );
    const span = container.querySelector("span")!;
    expect(span).toHaveAttribute("data-suffix", "%");
  });

  it('sets data-sign to "-" for negative values', () => {
    const { container } = renderWithProviders(<AnimatedNumber value={-7} />);
    const span = container.querySelector("span")!;
    expect(span).toHaveAttribute("data-sign", "-");
  });

  it('sets data-sign to "" for positive values', () => {
    const { container } = renderWithProviders(<AnimatedNumber value={7} />);
    const span = container.querySelector("span")!;
    expect(span).toHaveAttribute("data-sign", "");
  });

  it('sets data-sign to "" for zero', () => {
    const { container } = renderWithProviders(<AnimatedNumber value={0} />);
    const span = container.querySelector("span")!;
    expect(span).toHaveAttribute("data-sign", "");
  });

  it("uses correct defaults (no className, decimals=0, suffix='', duration=0.8)", () => {
    const { container } = renderWithProviders(<AnimatedNumber value={25} />);
    const span = container.querySelector("span")!;

    // className defaults to "" so class should be exactly the base classes
    expect(span).toHaveClass("animated-number");
    expect(span).toHaveClass("animated-number--decimals-0");

    // suffix defaults to ""
    expect(span).toHaveAttribute("data-suffix", "");

    // duration defaults to 0.8
    expect(span.style.getPropertyValue("--animation-duration")).toBe("0.8s");

    // --target-value is the absolute value
    expect(span.style.getPropertyValue("--target-value")).toBe("25");
  });
});
