import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import WhatsNewModal from "../AppMenu.component/WhatsNewModal";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockOpen = vi.fn();
const mockClose = vi.fn();

vi.mock("~/renderer/components", () => ({
  Badge: ({ children, variant, icon, ...props }: any) => (
    <span data-testid="badge" data-variant={variant} {...props}>
      {icon}
      {children}
    </span>
  ),
  MarkdownRenderer: ({ children, componentOverrides }: any) => {
    // Actually invoke the custom 'a' component override if present,
    // so we can test the three link type branches defined in whatsNewComponents.
    if (componentOverrides?.a) {
      const CustomA = componentOverrides.a;
      return (
        <div data-testid="markdown">
          <CustomA href="https://github.com/user/repo/commit/abc1234">
            abc1234
          </CustomA>
          <CustomA href="https://github.com/externaluser">
            @externaluser
          </CustomA>
          <CustomA href="https://github.com/coremaintainer">
            @coremaintainer
          </CustomA>
          <CustomA href="https://example.com">Normal link</CustomA>
        </div>
      );
    }
    return <div data-testid="markdown">{children}</div>;
  },
  Modal: React.forwardRef(({ children, onClose, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      open: mockOpen,
      close: mockClose,
    }));
    return (
      <div data-testid="modal" {...props}>
        {children}
      </div>
    );
  }),
}));

vi.mock("~/renderer/modules/changelog/Changelog.utils", () => ({
  CORE_MAINTAINERS: new Set(["coremaintainer"]),
  changeTypeColor: (type: string) => type,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    appMenu: {
      isWhatsNewOpen: false,
      whatsNewRelease: null,
      whatsNewIsLoading: false,
      whatsNewError: null,
      closeWhatsNew: vi.fn(),
      ...overrides.appMenu,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

const RELEASE_WITH_BODY = {
  name: "v2.0.0",
  body: "## Changes\n- Lots of stuff",
  changeType: "minor",
  publishedAt: "2024-08-01T00:00:00Z",
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("WhatsNewModal – custom whatsNewComponents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockOpen.mockClear();
    mockClose.mockClear();
  });

  // ── Commit hash links ────────────────────────────────────────────────

  it("renders commit hash link as an info badge with FiGitCommit icon", () => {
    setupStore({
      appMenu: { whatsNewRelease: RELEASE_WITH_BODY },
    });
    renderWithProviders(<WhatsNewModal />);

    // The commit link should be wrapped in a Badge with variant="info"
    const badges = screen.getAllByTestId("badge");
    const commitBadge = badges.find((b) => b.textContent?.includes("abc1234"));
    expect(commitBadge).toBeDefined();
    expect(commitBadge).toHaveAttribute("data-variant", "info");

    // The inner <a> should point to the commit URL
    const link = commitBadge!.querySelector("a");
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/user/repo/commit/abc1234",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  // ── Contributor handle links (non-maintainer) ────────────────────────

  it("renders non-maintainer contributor handle as an info badge with FiUser icon", () => {
    setupStore({
      appMenu: { whatsNewRelease: RELEASE_WITH_BODY },
    });
    renderWithProviders(<WhatsNewModal />);

    const badges = screen.getAllByTestId("badge");
    const contributorBadge = badges.find((b) =>
      b.textContent?.includes("@externaluser"),
    );
    expect(contributorBadge).toBeDefined();
    expect(contributorBadge).toHaveAttribute("data-variant", "info");

    // Should NOT contain "core maintainer" text
    expect(contributorBadge!.textContent).not.toContain("core maintainer");

    const link = contributorBadge!.querySelector("a");
    expect(link).toHaveAttribute("href", "https://github.com/externaluser");
  });

  // ── Contributor handle links (core maintainer) ───────────────────────

  it("renders core maintainer contributor handle as a success badge with core maintainer text", () => {
    setupStore({
      appMenu: { whatsNewRelease: RELEASE_WITH_BODY },
    });
    renderWithProviders(<WhatsNewModal />);

    const badges = screen.getAllByTestId("badge");
    const maintainerBadge = badges.find(
      (b) =>
        b.textContent?.includes("@coremaintainer") &&
        b.textContent?.includes("core maintainer"),
    );
    expect(maintainerBadge).toBeDefined();
    expect(maintainerBadge).toHaveAttribute("data-variant", "success");

    const link = maintainerBadge!.querySelector("a");
    expect(link).toHaveAttribute("href", "https://github.com/coremaintainer");
  });

  // ── Default links ────────────────────────────────────────────────────

  it("renders normal links with text-primary class and no badge wrapper", () => {
    setupStore({
      appMenu: { whatsNewRelease: RELEASE_WITH_BODY },
    });
    renderWithProviders(<WhatsNewModal />);

    const markdownEl = screen.getByTestId("markdown");
    // The default link is a plain <a> with class "text-primary", not inside a badge
    const allLinks = markdownEl.querySelectorAll("a");
    const normalLink = Array.from(allLinks).find(
      (a) => a.textContent === "Normal link",
    );
    expect(normalLink).toBeDefined();
    expect(normalLink).toHaveClass("text-primary");
    expect(normalLink).toHaveAttribute("href", "https://example.com");
    expect(normalLink).toHaveAttribute("target", "_blank");
    expect(normalLink).toHaveAttribute("rel", "noopener noreferrer");

    // The normal link should NOT be inside a badge element
    expect(normalLink!.closest("[data-testid='badge']")).toBeNull();
  });

  // ── Default link hover:underline ─────────────────────────────────────

  it("default links have hover:underline class", () => {
    setupStore({
      appMenu: { whatsNewRelease: RELEASE_WITH_BODY },
    });
    renderWithProviders(<WhatsNewModal />);

    const markdownEl = screen.getByTestId("markdown");
    const allLinks = markdownEl.querySelectorAll("a");
    const normalLink = Array.from(allLinks).find(
      (a) => a.textContent === "Normal link",
    );
    expect(normalLink).toHaveClass("hover:underline");
  });

  // ── Commit badge inner link has hover:underline ──────────────────────

  it("commit hash badge inner link has hover:underline class", () => {
    setupStore({
      appMenu: { whatsNewRelease: RELEASE_WITH_BODY },
    });
    renderWithProviders(<WhatsNewModal />);

    const badges = screen.getAllByTestId("badge");
    const commitBadge = badges.find((b) => b.textContent?.includes("abc1234"));
    const link = commitBadge!.querySelector("a");
    expect(link).toHaveClass("hover:underline");
  });
});

// ─── Modal sync with isWhatsNewOpen ────────────────────────────────────────

describe("WhatsNewModal – modal open/close sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockOpen.mockClear();
    mockClose.mockClear();
  });

  it("calls modal.open() when isWhatsNewOpen becomes true", () => {
    setupStore({ appMenu: { isWhatsNewOpen: true } });
    renderWithProviders(<WhatsNewModal />);

    expect(mockOpen).toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it("calls modal.close() when isWhatsNewOpen is false", () => {
    setupStore({ appMenu: { isWhatsNewOpen: false } });
    renderWithProviders(<WhatsNewModal />);

    expect(mockClose).toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
