import { describe, expect, it, vi } from "vitest";

import type { ChangelogEntry } from "~/main/modules/updater/Updater.api";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import ChangelogEntryCard from "./ChangelogEntryCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  Badge: ({ children, variant, icon, ...props }: any) => (
    <span data-testid="badge" data-variant={variant} {...props}>
      {icon}
      {children}
    </span>
  ),
  MarkdownRenderer: ({ children, className }: any) => (
    <div data-testid="markdown" data-classname={className}>
      {children}
    </div>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiGitCommit: (props: any) => <svg data-testid="icon-git-commit" {...props} />,
  FiShield: (props: any) => <svg data-testid="icon-shield" {...props} />,
  FiUser: (props: any) => <svg data-testid="icon-user" {...props} />,
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ChangelogEntryCard", () => {
  // ── Description ────────────────────────────────────────────────────────

  it("renders entry with description only", () => {
    const entry: ChangelogEntry = { description: "Fixed a bug" };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const markdowns = screen.getAllByTestId("markdown");
    expect(markdowns).toHaveLength(1);
    expect(markdowns[0]).toHaveTextContent("Fixed a bug");
  });

  it("does not render description markdown when description is absent", () => {
    const entry: ChangelogEntry = { description: "" };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    // Empty string is falsy, so no markdown should render for description
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  // ── Content (ChangelogContent) ─────────────────────────────────────────

  it("renders entry with content via ChangelogContent", () => {
    const entry: ChangelogEntry = {
      description: "A feature",
      content: "Detailed explanation of the feature",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const markdowns = screen.getAllByTestId("markdown");
    // One for description, one for ChangelogContent
    expect(markdowns.length).toBeGreaterThanOrEqual(2);
    expect(
      markdowns.some((el) =>
        el.textContent?.includes("Detailed explanation of the feature"),
      ),
    ).toBe(true);
  });

  it("does not render ChangelogContent when content is not provided", () => {
    const entry: ChangelogEntry = { description: "Just description" };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const markdowns = screen.getAllByTestId("markdown");
    expect(markdowns).toHaveLength(1);
  });

  // ── Sub-items ──────────────────────────────────────────────────────────

  it("renders entry with subItems as a markdown list", () => {
    const entry: ChangelogEntry = {
      description: "Changes",
      subItems: ["First thing", "Second thing", "Third thing"],
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const markdowns = screen.getAllByTestId("markdown");
    // One for description, one for subItems
    expect(markdowns.length).toBeGreaterThanOrEqual(2);

    const subItemsMarkdown = markdowns.find((el) =>
      el.textContent?.includes("- First thing"),
    );
    expect(subItemsMarkdown).toBeDefined();
    expect(subItemsMarkdown!.textContent).toContain("- Second thing");
    expect(subItemsMarkdown!.textContent).toContain("- Third thing");
  });

  it("does not render subItems section when subItems is empty array", () => {
    const entry: ChangelogEntry = {
      description: "No sub-items",
      subItems: [],
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const markdowns = screen.getAllByTestId("markdown");
    expect(markdowns).toHaveLength(1); // only description
  });

  it("does not render subItems section when subItems is not provided", () => {
    const entry: ChangelogEntry = { description: "Nothing extra" };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const markdowns = screen.getAllByTestId("markdown");
    expect(markdowns).toHaveLength(1);
  });

  // ── Commit hash badge ──────────────────────────────────────────────────

  it("renders commit hash badge truncated to 7 characters", () => {
    const entry: ChangelogEntry = {
      description: "Fix",
      commitHash: "abc1234567890def",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const badges = screen.getAllByTestId("badge");
    const commitBadge = badges.find((b) => b.textContent?.includes("abc1234"));
    expect(commitBadge).toBeDefined();
    expect(commitBadge).toHaveAttribute("data-variant", "info");
    expect(commitBadge!.textContent).not.toContain("abc1234567890def");
  });

  it("renders commit hash as link when commitUrl is provided", () => {
    const entry: ChangelogEntry = {
      description: "Fix",
      commitHash: "abc1234567890def",
      commitUrl: "https://github.com/repo/commit/abc1234567890def",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const link = screen.getByText("abc1234").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/repo/commit/abc1234567890def",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders commit hash as plain text when commitUrl is not provided", () => {
    const entry: ChangelogEntry = {
      description: "Fix",
      commitHash: "abc1234567890def",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText("abc1234").closest("a")).toBeNull();
  });

  it("renders git commit icon in commit badge", () => {
    const entry: ChangelogEntry = {
      description: "Fix",
      commitHash: "abc1234567890def",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    expect(screen.getByTestId("icon-git-commit")).toBeInTheDocument();
  });

  // ── Contributor badge ──────────────────────────────────────────────────

  it("renders contributor badge with @ prefix", () => {
    const entry: ChangelogEntry = {
      description: "Feature",
      contributor: "someuser",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    expect(screen.getByText("@someuser")).toBeInTheDocument();
  });

  it('shows "core maintainer" text for CORE_MAINTAINERS entries', () => {
    const entry: ChangelogEntry = {
      description: "Core fix",
      contributor: "sbsrnt",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    expect(screen.getByText(/core maintainer/)).toBeInTheDocument();
  });

  it("uses success variant badge for core maintainer", () => {
    const entry: ChangelogEntry = {
      description: "Core fix",
      contributor: "sbsrnt",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const badges = screen.getAllByTestId("badge");
    const contributorBadge = badges.find((b) =>
      b.textContent?.includes("@sbsrnt"),
    );
    expect(contributorBadge).toHaveAttribute("data-variant", "success");
  });

  it("uses info variant badge for non-core contributor", () => {
    const entry: ChangelogEntry = {
      description: "Community fix",
      contributor: "external-user",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const badges = screen.getAllByTestId("badge");
    const contributorBadge = badges.find((b) =>
      b.textContent?.includes("@external-user"),
    );
    expect(contributorBadge).toHaveAttribute("data-variant", "info");
  });

  it("does not show core maintainer text for non-core contributors", () => {
    const entry: ChangelogEntry = {
      description: "Community fix",
      contributor: "external-user",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    expect(screen.queryByText(/core maintainer/)).not.toBeInTheDocument();
  });

  it("renders shield icon for core maintainer", () => {
    const entry: ChangelogEntry = {
      description: "Fix",
      contributor: "sbsrnt",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    expect(screen.getByTestId("icon-shield")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-user")).not.toBeInTheDocument();
  });

  it("renders user icon for non-core contributor", () => {
    const entry: ChangelogEntry = {
      description: "Fix",
      contributor: "someone-else",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    expect(screen.getByTestId("icon-user")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-shield")).not.toBeInTheDocument();
  });

  it("renders contributor as link when contributorUrl is provided", () => {
    const entry: ChangelogEntry = {
      description: "Feature",
      contributor: "someuser",
      contributorUrl: "https://github.com/someuser",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    const link = screen.getByText("@someuser").closest("a");
    expect(link).toHaveAttribute("href", "https://github.com/someuser");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders contributor as plain text when contributorUrl is not provided", () => {
    const entry: ChangelogEntry = {
      description: "Feature",
      contributor: "someuser",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    expect(screen.getByText("@someuser")).toBeInTheDocument();
    expect(screen.getByText("@someuser").closest("a")).toBeNull();
  });

  // ── No optional fields ─────────────────────────────────────────────────

  it("handles entry with no optional fields without errors", () => {
    const entry: ChangelogEntry = { description: "" };

    const { container } = renderWithProviders(
      <ChangelogEntryCard entry={entry} />,
    );

    // Should render the outer div without crashing
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  // ── Combined fields ────────────────────────────────────────────────────

  it("renders all fields together correctly", () => {
    const entry: ChangelogEntry = {
      description: "Big feature update",
      content: "Detailed markdown content",
      subItems: ["Sub item A", "Sub item B"],
      commitHash: "deadbeef12345678",
      commitUrl: "https://github.com/repo/commit/deadbeef12345678",
      contributor: "sbsrnt",
      contributorUrl: "https://github.com/sbsrnt",
    };

    renderWithProviders(<ChangelogEntryCard entry={entry} />);

    // Description
    expect(screen.getByText("Big feature update")).toBeInTheDocument();

    // Commit badge
    expect(screen.getByText("deadbee")).toBeInTheDocument();

    // Contributor badge with core maintainer
    expect(screen.getByText(/core maintainer/)).toBeInTheDocument();

    // Both badges rendered
    const badges = screen.getAllByTestId("badge");
    expect(badges).toHaveLength(2);
  });
});
