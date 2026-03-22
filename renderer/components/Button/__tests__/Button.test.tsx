import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import Button from "../Button";

describe("Button", () => {
  it("renders children", () => {
    renderWithProviders(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it('always has "no-drag" and "btn" classes', () => {
    renderWithProviders(<Button>Base</Button>);
    const button = screen.getByRole("button", { name: "Base" });
    expect(button).toHaveClass("no-drag", "btn");
  });

  it("does not add a variant class when variant is not provided", () => {
    renderWithProviders(<Button>No variant</Button>);
    const button = screen.getByRole("button", { name: "No variant" });
    expect(button.className).not.toMatch(
      /btn-primary|btn-secondary|btn-accent|btn-ghost|btn-link|btn-info|btn-success|btn-warning|btn-error/,
    );
  });

  it.each([
    ["primary", "btn-primary"],
    ["ghost", "btn-ghost"],
    ["error", "btn-error"],
  ] as const)("variant=%s applies %s class", (variant, expected) => {
    renderWithProviders(<Button variant={variant}>V</Button>);
    const button = screen.getByRole("button", { name: "V" });
    expect(button).toHaveClass(expected);
  });

  it.each([
    ["lg", "btn-lg"],
    ["sm", "btn-sm"],
    ["xs", "btn-xs"],
  ] as const)("size=%s applies %s class", (size, expected) => {
    renderWithProviders(<Button size={size}>S</Button>);
    const button = screen.getByRole("button", { name: "S" });
    expect(button).toHaveClass(expected);
  });

  it.each([
    ["outline", "btn-outline"],
    ["soft", "btn-soft"],
    ["wide", "btn-wide"],
    ["block", "btn-block"],
    ["circle", "btn-circle"],
    ["square", "btn-square"],
    ["glass", "glass"],
    ["loading", "loading"],
    ["active", "btn-active"],
  ] as const)("boolean prop %s applies %s class", (prop, expected) => {
    renderWithProviders(<Button {...{ [prop]: true }}>B</Button>);
    const button = screen.getByRole("button", { name: "B" });
    expect(button).toHaveClass(expected);
  });

  it("is disabled when disabled=true", () => {
    renderWithProviders(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });

  it("is disabled when loading=true", () => {
    renderWithProviders(<Button loading>Loading</Button>);
    expect(screen.getByRole("button", { name: "Loading" })).toBeDisabled();
  });

  it("fires click handler when clicked", async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <Button onClick={handleClick}>Clickable</Button>,
    );
    await user.click(screen.getByRole("button", { name: "Clickable" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire click handler when disabled", async () => {
    const handleClick = vi.fn();
    const { user } = renderWithProviders(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Disabled" }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("merges custom className", () => {
    renderWithProviders(<Button className="my-custom-class">Custom</Button>);
    const button = screen.getByRole("button", { name: "Custom" });
    expect(button).toHaveClass("btn", "no-drag", "my-custom-class");
  });

  it("forwards spread props such as type and aria-label", () => {
    renderWithProviders(
      <Button type="submit" aria-label="Submit form">
        Go
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Submit form" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-label", "Submit form");
  });
});
