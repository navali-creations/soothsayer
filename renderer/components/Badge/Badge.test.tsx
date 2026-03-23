import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import Badge from "./Badge";

describe("Badge", () => {
  it("renders children", () => {
    renderWithProviders(<Badge>Hello Badge</Badge>);
    expect(screen.getByText("Hello Badge")).toBeInTheDocument();
  });

  it("applies badge-neutral class by default (default variant)", () => {
    renderWithProviders(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toHaveClass("badge-neutral");
  });

  it("applies badge-sm class by default (default size)", () => {
    renderWithProviders(<Badge>Default Size</Badge>);
    const badge = screen.getByText("Default Size");
    expect(badge).toHaveClass("badge-sm");
  });

  it.each([
    ["primary", "badge-primary"],
    ["error", "badge-error"],
    ["ghost", "badge-ghost"],
  ] as const)("variant=%s applies %s class", (variant, expectedClass) => {
    renderWithProviders(<Badge variant={variant}>V</Badge>);
    const badge = screen.getByText("V");
    expect(badge).toHaveClass(expectedClass);
  });

  it.each([
    ["xs", "badge-xs"],
    ["sm", "badge-sm"],
    ["md", "badge-md"],
    ["lg", "badge-lg"],
  ] as const)("size=%s applies %s class", (size, expectedClass) => {
    renderWithProviders(<Badge size={size}>S</Badge>);
    const badge = screen.getByText("S");
    expect(badge).toHaveClass(expectedClass);
  });

  it("applies badge-outline when outline=true", () => {
    renderWithProviders(<Badge outline>Outlined</Badge>);
    const badge = screen.getByText("Outlined");
    expect(badge).toHaveClass("badge-outline");
  });

  it("applies badge-soft when soft=true", () => {
    renderWithProviders(<Badge soft>Soft</Badge>);
    const badge = screen.getByText("Soft");
    expect(badge).toHaveClass("badge-soft");
  });

  it("merges custom className", () => {
    renderWithProviders(<Badge className="my-custom-class">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge).toHaveClass("badge", "my-custom-class");
  });

  it("renders icon when provided", () => {
    renderWithProviders(
      <Badge icon={<svg data-testid="badge-icon" />}>With Icon</Badge>,
    );
    expect(screen.getByTestId("badge-icon")).toBeInTheDocument();
    // The icon is wrapped in a span with flex classes
    const iconWrapper = screen.getByTestId("badge-icon").parentElement;
    expect(iconWrapper).toHaveClass("flex", "items-center", "shrink-0");
  });

  it("does not render icon span when icon is not provided", () => {
    renderWithProviders(<Badge>No Icon</Badge>);
    const badge = screen.getByText("No Icon");
    // The badge should only contain the text node, no child span for an icon
    const spans = badge.querySelectorAll("span");
    expect(spans).toHaveLength(0);
  });

  it('always has base classes "badge", "gap-1", and "font-normal"', () => {
    renderWithProviders(<Badge>Base</Badge>);
    const badge = screen.getByText("Base");
    expect(badge).toHaveClass("badge", "gap-1", "font-normal");
    expect(badge.tagName).toBe("SPAN");
  });
});
