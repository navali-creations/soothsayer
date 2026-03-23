import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import ChangelogContent from "../Changelog.components/ChangelogContent";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  MarkdownRenderer: ({ children, className }: any) => (
    <div data-testid="markdown" data-classname={className}>
      {children}
    </div>
  ),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ChangelogContent", () => {
  // ── Null / empty cases ─────────────────────────────────────────────────

  it("returns null for an empty string", () => {
    const { container } = renderWithProviders(<ChangelogContent content="" />);

    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  it("returns null for a whitespace-only string", () => {
    const { container } = renderWithProviders(
      <ChangelogContent content="   " />,
    );

    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  it("returns null for a string with only newlines and tabs", () => {
    const { container } = renderWithProviders(
      <ChangelogContent content={"\n\t\n  \t"} />,
    );

    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  // ── Rendering content ──────────────────────────────────────────────────

  it("renders MarkdownRenderer with content when content is non-empty", () => {
    renderWithProviders(<ChangelogContent content="Some changelog details" />);

    const markdown = screen.getByTestId("markdown");
    expect(markdown).toBeInTheDocument();
    expect(markdown).toHaveTextContent("Some changelog details");
  });

  it("renders markdown content that has leading/trailing whitespace", () => {
    renderWithProviders(
      <ChangelogContent content="  Has whitespace around  " />,
    );

    const markdown = screen.getByTestId("markdown");
    expect(markdown).toBeInTheDocument();
    expect(markdown).toHaveTextContent("Has whitespace around");
  });

  // ── className ──────────────────────────────────────────────────────────

  it('passes className "mt-3" to MarkdownRenderer', () => {
    renderWithProviders(<ChangelogContent content="Some content" />);

    const markdown = screen.getByTestId("markdown");
    expect(markdown).toHaveAttribute("data-classname", "mt-3");
  });

  // ── Multiline content ──────────────────────────────────────────────────

  it("renders multiline markdown content", () => {
    const multiline = "# Heading\n\nSome paragraph\n\n- Item 1\n- Item 2";
    renderWithProviders(<ChangelogContent content={multiline} />);

    const markdown = screen.getByTestId("markdown");
    expect(markdown).toBeInTheDocument();
    expect(markdown).toHaveTextContent("# Heading");
  });
});
