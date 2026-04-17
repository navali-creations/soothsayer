import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChangelogRelease } from "~/main/modules/updater/Updater.api";
import {
  renderWithProviders,
  screen,
  userEvent,
} from "~/renderer/__test-setup__/render";

import ReleaseTimelineItem from "./ReleaseTimelineItem";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span
      data-testid="badge"
      data-variant={variant}
      className={className}
      {...props}
    >
      {children}
    </span>
  ),
}));

vi.mock("../ChangelogEntryCard/ChangelogEntryCard", () => ({
  default: ({ entry }: any) => (
    <div data-testid="changelog-entry-card">{entry.description}</div>
  ),
}));

vi.mock("../../Changelog.utils/Changelog.utils", () => ({
  changeTypeColor: (changeType: string) => {
    if (changeType.toLowerCase().includes("minor")) return "success";
    if (changeType.toLowerCase().includes("major")) return "warning";
    if (changeType.toLowerCase().includes("patch")) return "info";
    return "accent";
  },
  hoverBorderColorClass: (color: string) => `hover:border-${color}`,
  releaseUrl: (version: string) =>
    `https://github.com/navali-creations/soothsayer/releases/tag/v${version}`,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const BASE_RELEASE: ChangelogRelease = {
  version: "1.2.3",
  changeType: "patch",
  entries: [{ description: "Fixed a bug" }],
};

function renderItem({
  release = BASE_RELEASE,
  isLast = false,
  isCurrent = false,
}: {
  release?: ChangelogRelease;
  isLast?: boolean;
  isCurrent?: boolean;
} = {}) {
  return renderWithProviders(
    <ReleaseTimelineItem
      release={release}
      isLast={isLast}
      isCurrent={isCurrent}
    />,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ReleaseTimelineItem", () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Version badge ──────────────────────────────────────────────────────

  it("renders version badge with the release version", () => {
    renderItem();

    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
  });

  it("renders version badge as a link to the release URL", () => {
    renderItem();

    const versionLink = screen.getByText("v1.2.3").closest("a");
    expect(versionLink).toHaveAttribute(
      "href",
      "https://github.com/navali-creations/soothsayer/releases/tag/v1.2.3",
    );
    expect(versionLink).toHaveAttribute("target", "_blank");
    expect(versionLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("uses the correct color variant for the version badge", () => {
    renderItem({
      release: { ...BASE_RELEASE, changeType: "minor" },
    });

    const badges = screen.getAllByTestId("badge");
    const versionBadge = badges.find((b) => b.textContent?.includes("v1.2.3"));
    expect(versionBadge).toHaveAttribute("data-variant", "success");
  });

  // ── Current badge ──────────────────────────────────────────────────────

  it('shows "current" badge when isCurrent is true', () => {
    renderItem({ isCurrent: true });

    expect(screen.getByText("current")).toBeInTheDocument();
  });

  it('does not show "current" badge when isCurrent is false', () => {
    renderItem({ isCurrent: false });

    expect(screen.queryByText("current")).not.toBeInTheDocument();
  });

  it('"current" badge has success variant', () => {
    renderItem({ isCurrent: true });

    const badges = screen.getAllByTestId("badge");
    const currentBadge = badges.find((b) => b.textContent?.includes("current"));
    expect(currentBadge).toHaveAttribute("data-variant", "success");
  });

  // ── Timeline connector ─────────────────────────────────────────────────

  it("shows timeline connector when isLast is false", () => {
    const { container } = renderItem({ isLast: false });

    const connector = container.querySelector(".bg-base-content\\/10");
    expect(connector).toBeInTheDocument();
  });

  it("hides timeline connector when isLast is true", () => {
    const { container } = renderItem({ isLast: true });

    const connector = container.querySelector(".bg-base-content\\/10");
    expect(connector).not.toBeInTheDocument();
  });

  // ── Entries ────────────────────────────────────────────────────────────

  it("renders all changelog entry cards", () => {
    const release: ChangelogRelease = {
      version: "2.0.0",
      changeType: "major",
      entries: [
        { description: "Entry one" },
        { description: "Entry two" },
        { description: "Entry three" },
      ],
    };

    renderItem({ release });

    const cards = screen.getAllByTestId("changelog-entry-card");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Entry one");
    expect(cards[1]).toHaveTextContent("Entry two");
    expect(cards[2]).toHaveTextContent("Entry three");
  });

  // ── Click behavior ─────────────────────────────────────────────────────

  it("clicking card opens window with release URL", async () => {
    const { user } = renderItem();

    // There are two elements with role="link": the <a> wrapping the version badge
    // and the <div role="link"> card. We want the div.
    const links = screen.getAllByRole("link");
    const card = links.find((el) => el.tagName === "DIV")!;
    await user.click(card);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://github.com/navali-creations/soothsayer/releases/tag/v1.2.3",
      "_blank",
    );
  });

  it("clicking an inner link does NOT open the release URL", async () => {
    const release: ChangelogRelease = {
      version: "1.0.0",
      changeType: "patch",
      entries: [{ description: "Fix" }],
    };

    renderWithProviders(
      <ReleaseTimelineItem
        release={release}
        isLast={false}
        isCurrent={false}
      />,
    );

    // Find the card div (role="link" with tagName DIV)
    const links = screen.getAllByRole("link");
    const card = links.find((el) => el.tagName === "DIV")!;

    // Insert an anchor inside the card to simulate an inner link being clicked
    const innerLink = document.createElement("a");
    innerLink.href = "https://github.com/user";
    innerLink.textContent = "inner link";
    card.querySelector(".card-body")?.appendChild(innerLink);

    // Click the inner link
    await userEvent.click(innerLink);

    // The card's click handler should detect e.target.closest("a") and bail out
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it("keyboard Enter on card opens the release URL and calls preventDefault", () => {
    renderItem();

    const links = screen.getAllByRole("link");
    const card = links.find((el) => el.tagName === "DIV")!;

    const prevented = fireEvent.keyDown(card, { key: "Enter" });

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://github.com/navali-creations/soothsayer/releases/tag/v1.2.3",
      "_blank",
    );
    // fireEvent returns false when preventDefault was called
    expect(prevented).toBe(false);
  });

  it("keyboard Space on card opens the release URL and calls preventDefault", () => {
    renderItem();

    const links = screen.getAllByRole("link");
    const card = links.find((el) => el.tagName === "DIV")!;

    const prevented = fireEvent.keyDown(card, { key: " " });

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://github.com/navali-creations/soothsayer/releases/tag/v1.2.3",
      "_blank",
    );
    expect(prevented).toBe(false);
  });

  it("keyboard other keys do not open the release URL", () => {
    renderItem();

    const links = screen.getAllByRole("link");
    const card = links.find((el) => el.tagName === "DIV")!;

    fireEvent.keyDown(card, { key: "Tab" });

    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  // ── Structure ──────────────────────────────────────────────────────────

  it("renders as a list item", () => {
    const { container } = renderItem();

    expect(container.querySelector("li")).toBeInTheDocument();
  });

  it("card has role=link and is focusable", () => {
    renderItem();

    const links = screen.getAllByRole("link");
    const card = links.find((el) => el.tagName === "DIV")!;
    expect(card).toHaveAttribute("tabindex", "0");
  });
});
