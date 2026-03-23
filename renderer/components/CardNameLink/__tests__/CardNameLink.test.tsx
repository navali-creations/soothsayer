import { vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import CardNameLink from "../CardNameLink";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components/Link/Link", () => ({
  default: ({ children, to, params, className, ...props }: any) => (
    <a
      href={`${to}/${params?.cardSlug || ""}`}
      className={className}
      data-testid="card-link"
      {...props}
    >
      {children}
    </a>
  ),
  Link: ({ children, to, params, className, ...props }: any) => (
    <a
      href={`${to}/${params?.cardSlug || ""}`}
      className={className}
      data-testid="card-link"
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("~/renderer/utils", () => ({
  cardNameToSlug: vi.fn((name: string) =>
    name.toLowerCase().replace(/ /g, "-"),
  ),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CardNameLink", () => {
  it("renders the card name as text content", () => {
    renderWithProviders(<CardNameLink cardName="The Doctor" />);

    expect(screen.getByText("The Doctor")).toBeInTheDocument();
  });

  it("creates a link with the correct slug from cardNameToSlug", () => {
    renderWithProviders(<CardNameLink cardName="Rain of Chaos" />);

    const link = screen.getByTestId("card-link");
    expect(link).toHaveAttribute("href", "/cards/$cardSlug/rain-of-chaos");
  });

  it("applies base CSS classes (truncate, font-fontin, etc.)", () => {
    renderWithProviders(<CardNameLink cardName="The Wretched" />);

    const link = screen.getByTestId("card-link");
    expect(link).toHaveClass("truncate");
    expect(link).toHaveClass("font-fontin");
    expect(link).toHaveClass("hover:text-primary");
    expect(link).toHaveClass("transition-colors");
    expect(link).toHaveClass("underline");
    expect(link).toHaveClass("decoration-dotted");
  });

  it("merges a custom className with the base classes", () => {
    renderWithProviders(
      <CardNameLink cardName="House of Mirrors" className="font-semibold" />,
    );

    const link = screen.getByTestId("card-link");
    // Base classes still present
    expect(link).toHaveClass("truncate");
    expect(link).toHaveClass("font-fontin");
    expect(link).toHaveClass("underline");
    // Custom class also present
    expect(link).toHaveClass("font-semibold");
  });

  it("works without a custom className", () => {
    renderWithProviders(<CardNameLink cardName="The Nurse" />);

    const link = screen.getByTestId("card-link");
    // Should have the base classes and nothing extra unexpected
    expect(link).toHaveClass("truncate");
    expect(link).toHaveClass("font-fontin");
    expect(link).toHaveClass("hover:text-primary");
    expect(link).toHaveClass("transition-colors");
    expect(link).toHaveClass("underline");
    expect(link).toHaveClass("decoration-dotted");
    // The className attribute should only contain base classes (no trailing undefined, etc.)
    expect(link.className).not.toContain("undefined");
  });
});
