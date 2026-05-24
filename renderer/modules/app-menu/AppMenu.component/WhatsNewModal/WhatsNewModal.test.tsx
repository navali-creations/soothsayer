import React from "react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
  MarkdownRenderer: ({ children }: any) => (
    <div data-testid="markdown">{children}</div>
  ),
  Modal: React.forwardRef(({ children, onClose, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ open: vi.fn(), close: vi.fn() }));
    return (
      <div data-testid="modal" {...props}>
        {children}
      </div>
    );
  }),
}));

vi.mock(
  "~/renderer/modules/changelog/Changelog.utils/Changelog.utils",
  async () => {
    const actual = await vi.importActual<
      typeof import("~/renderer/modules/changelog/Changelog.utils/Changelog.utils")
    >("~/renderer/modules/changelog/Changelog.utils/Changelog.utils");

    return {
      ...actual,
      CORE_MAINTAINERS: new Set(),
    };
  },
);

const mockUseBoundStore = vi.mocked(useBoundStore);

import WhatsNewModal from "./WhatsNewModal";

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    appMenu: {
      isWhatsNewOpen: false,
      whatsNewRelease: null,
      whatsNewReleases: [],
      whatsNewSelectedVersion: null,
      whatsNewIsLoading: false,
      whatsNewError: null,
      closeWhatsNew: vi.fn(),
      selectWhatsNewRelease: vi.fn(),
      ...overrides.appMenu,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("WhatsNewModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Soothsayer" title when no release', () => {
    setupStore();
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByText("Soothsayer")).toBeInTheDocument();
  });

  it("keeps the title compact when whatsNewRelease exists", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          version: "1.5.0",
          name: "v1.5.0",
          body: "Some changes",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByText("Soothsayer")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "v1.5.0" }),
    ).not.toBeInTheDocument();
  });

  it("shows loading spinner when whatsNewIsLoading is true", () => {
    setupStore({
      appMenu: {
        whatsNewIsLoading: true,
      },
    });
    renderWithProviders(<WhatsNewModal />);

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("shows error alert when whatsNewError is set", () => {
    setupStore({
      appMenu: {
        whatsNewError: "Could not fetch release information.",
        whatsNewIsLoading: false,
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(
      screen.getByText("Could not fetch release information."),
    ).toBeInTheDocument();
    const alert = document.querySelector(".alert-error");
    expect(alert).toBeInTheDocument();
  });

  it("does not show error alert when loading", () => {
    setupStore({
      appMenu: {
        whatsNewError: "Some error",
        whatsNewIsLoading: true,
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.queryByText("Some error")).not.toBeInTheDocument();
  });

  it("shows release body content via MarkdownRenderer", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          version: "1.5.0",
          name: "v1.5.0",
          body: "## Changes\n- Feature A",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByTestId("markdown")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent(
      /## Changes.*Feature A/,
    );
  });

  it('shows "No detailed changes available" when release has no body', () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          version: "1.5.0",
          name: "v1.5.0",
          body: "",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(
      screen.getByText("No detailed changes available for this release."),
    ).toBeInTheDocument();
  });

  it("shows release date when publishedAt exists", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          version: "1.5.0",
          name: "v1.5.0",
          body: "Changes",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    // The component formats the date using toLocaleDateString
    const dateEl = screen.getByText(/Released/);
    expect(dateEl).toBeInTheDocument();
    // The date string will contain "June" and "2024" in most locales
    expect(dateEl.textContent).toContain("2024");
  });

  it("does not show release date when publishedAt is missing", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          version: "1.5.0",
          name: "v1.5.0",
          body: "Changes",
          changeType: "minor",
          publishedAt: null,
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.queryByText(/Released/)).not.toBeInTheDocument();
  });

  it("shows Close button that calls closeWhatsNew()", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<WhatsNewModal />);

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toBeInTheDocument();

    await user.click(closeButton);

    expect(store.appMenu.closeWhatsNew).toHaveBeenCalledTimes(1);
  });

  it("does not show change type badge in the header", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          version: "1.5.0",
          name: "v1.5.0",
          body: "Changes",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("does not show change type badge when no release", () => {
    setupStore();
    renderWithProviders(<WhatsNewModal />);

    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("renders the modal container", () => {
    setupStore();
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });

  it("shows release version tabs when multiple releases are available", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          version: "1.5.0",
          name: "v1.5.0",
          body: "Minor changes",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
        whatsNewReleases: [
          {
            version: "1.5.0",
            name: "v1.5.0",
            body: "Minor changes",
            changeType: "minor",
            publishedAt: "2024-06-15T00:00:00Z",
          },
          {
            version: "1.5.1",
            name: "v1.5.1",
            body: "Patch changes",
            changeType: "patch",
            publishedAt: "2024-06-16T00:00:00Z",
          },
        ],
        whatsNewSelectedVersion: "1.5.0",
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByRole("tab", { name: "v1.5.0" })).toHaveClass(
      "bg-success/15",
      "text-success",
    );
    expect(screen.getByRole("tab", { name: "v1.5.1" })).toHaveClass(
      "text-info/70",
    );
  });

  it("shows the release version tab when only one release is available", () => {
    setupStore({
      appMenu: {
        whatsNewRelease: {
          version: "1.5.0",
          name: "v1.5.0",
          body: "Minor changes",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
        whatsNewReleases: [
          {
            version: "1.5.0",
            name: "v1.5.0",
            body: "Minor changes",
            changeType: "minor",
            publishedAt: "2024-06-15T00:00:00Z",
          },
        ],
        whatsNewSelectedVersion: "1.5.0",
      },
    });
    renderWithProviders(<WhatsNewModal />);

    expect(screen.getByRole("tab", { name: "v1.5.0" })).toBeInTheDocument();
  });

  it("selects a release when a version tab is clicked", async () => {
    const store = setupStore({
      appMenu: {
        whatsNewRelease: {
          version: "1.5.0",
          name: "v1.5.0",
          body: "Minor changes",
          changeType: "minor",
          publishedAt: "2024-06-15T00:00:00Z",
        },
        whatsNewReleases: [
          {
            version: "1.5.0",
            name: "v1.5.0",
            body: "Minor changes",
            changeType: "minor",
            publishedAt: "2024-06-15T00:00:00Z",
          },
          {
            version: "1.5.1",
            name: "v1.5.1",
            body: "Patch changes",
            changeType: "patch",
            publishedAt: "2024-06-16T00:00:00Z",
          },
        ],
        whatsNewSelectedVersion: "1.5.0",
      },
    });
    const { user } = renderWithProviders(<WhatsNewModal />);

    await user.click(screen.getByRole("tab", { name: "v1.5.1" }));

    expect(store.appMenu.selectWhatsNewRelease).toHaveBeenCalledWith("1.5.1");
  });
});
