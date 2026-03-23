import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import AttributionsPage from "../Attributions.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, subtitle }: any) => (
        <div data-testid="page-header">
          <span data-testid="page-title">{title}</span>
          <span data-testid="page-subtitle">{subtitle}</span>
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiExternalLink: (props: any) => (
    <svg data-testid="external-link-icon" {...props} />
  ),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("AttributionsPage", () => {
  // ── Page structure ─────────────────────────────────────────────────────

  it("renders the PageContainer", () => {
    renderWithProviders(<AttributionsPage />);

    expect(screen.getByTestId("page-container")).toBeInTheDocument();
  });

  it('renders page header with "Attributions" title', () => {
    renderWithProviders(<AttributionsPage />);

    expect(screen.getByTestId("page-title")).toHaveTextContent("Attributions");
  });

  it("renders the page subtitle", () => {
    renderWithProviders(<AttributionsPage />);

    expect(screen.getByTestId("page-subtitle")).toHaveTextContent(
      "Credit to the third-party data sources that make this app possible.",
    );
  });

  // ── Attribution cards ──────────────────────────────────────────────────

  it("renders all three attribution cards", () => {
    renderWithProviders(<AttributionsPage />);

    expect(screen.getByText("Prohibited Library")).toBeInTheDocument();
    expect(screen.getByText("poe.ninja")).toBeInTheDocument();
    expect(screen.getByText("PoE Wiki")).toBeInTheDocument();
  });

  it("renders the Prohibited Library card with correct description", () => {
    renderWithProviders(<AttributionsPage />);

    expect(
      screen.getByText(
        "Divination card drop weight data sourced from community-maintained research.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the poe.ninja card with correct description", () => {
    renderWithProviders(<AttributionsPage />);

    expect(
      screen.getByText("Pricing and economy data for Path of Exile items."),
    ).toBeInTheDocument();
  });

  it("renders the PoE Wiki card with correct description", () => {
    renderWithProviders(<AttributionsPage />);

    expect(
      screen.getByText("Divination card information and images."),
    ).toBeInTheDocument();
  });

  // ── Links ──────────────────────────────────────────────────────────────

  it("links Prohibited Library to the correct URL with target=_blank", () => {
    renderWithProviders(<AttributionsPage />);

    const link = screen.getByText("Prohibited Library").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "https://docs.google.com/spreadsheets/d/1PmGES_e1on6K7O5ghHuoorEjruAVb7dQ5m7PGrW7t80/edit?gid=272334906#gid=272334906",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("links poe.ninja to the correct URL with target=_blank", () => {
    renderWithProviders(<AttributionsPage />);

    const link = screen.getByText("poe.ninja").closest("a");
    expect(link).toHaveAttribute("href", "https://poe.ninja/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("links PoE Wiki to the correct URL with target=_blank", () => {
    renderWithProviders(<AttributionsPage />);

    const link = screen.getByText("PoE Wiki").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "https://www.poewiki.net/wiki/Divination_card",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  // ── External link icons ────────────────────────────────────────────────

  it("renders an external link icon for each attribution card", () => {
    renderWithProviders(<AttributionsPage />);

    const icons = screen.getAllByTestId("external-link-icon");
    expect(icons).toHaveLength(3);
  });
});
