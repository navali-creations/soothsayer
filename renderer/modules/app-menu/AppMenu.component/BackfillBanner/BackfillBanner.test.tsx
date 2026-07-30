import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import BackfillBanner from "./BackfillBanner";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", async () => {
  const { createRouterMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createRouterMock({ includeLink: true });
});

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("react-icons/fi", () => ({
  FiUploadCloud: (props: any) => (
    <svg data-testid="upload-cloud-icon" {...props} />
  ),
  FiExternalLink: (props: any) => (
    <svg data-testid="external-link-icon" {...props} />
  ),
}));

vi.mock("~/main/modules/banners/Banners.types", () => ({
  BANNER_IDS: {
    COMMUNITY_BACKFILL: "community-backfill",
  },
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    communityUpload: {
      backfillLeagues: [],
      isBackfilling: false,
      backfillError: null,
      checkBackfill: vi.fn(),
      triggerBackfill: vi.fn(),
      dismissBackfillBanner: vi.fn(),
      ...overrides.communityUpload,
    },
    banners: {
      dismissedIds: new Set<string>(),
      loadStatus: "ready",
      loadDismissed: vi.fn(),
      dismiss: vi.fn(),
      markDismissed: vi.fn(),
      ...overrides.banners,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("BackfillBanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Visibility ───────────────────────────────────────────────────────

  it("returns null when backfillLeagues is empty", () => {
    setupStore({ communityUpload: { backfillLeagues: [] } });

    const { container } = renderWithProviders(<BackfillBanner />);

    expect(container.innerHTML).toBe("");
  });

  it("returns null when banner is permanently dismissed via banners slice", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe2", league: "Dawn" }],
      },
      banners: {
        dismissedIds: new Set(["community-backfill"]),
        loadStatus: "ready",
      },
    });

    const { container } = renderWithProviders(<BackfillBanner />);

    expect(container.innerHTML).toBe("");
  });

  it("does not render until persisted banner dismissals are loaded", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
      banners: {
        loadStatus: "loading",
      },
    });

    const { container } = renderWithProviders(<BackfillBanner />);

    expect(container.innerHTML).toBe("");
  });

  // ── Content ──────────────────────────────────────────────────────────

  it("renders a link to wraeclast.cards", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    const link = screen.getByRole("link", { name: /wraeclast\.cards/ });
    expect(link).toHaveAttribute("href", "https://wraeclast.cards");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders external link icons next to the links", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    const icons = screen.getAllByTestId("external-link-icon");
    expect(icons).toHaveLength(2);
  });

  it("renders an in-app link to the Privacy Policy", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    const link = screen.getByText("Privacy Policy").closest("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("to", "/privacy-policy");
  });

  it("mentions existing and future drop data without claiming anonymity", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    expect(
      screen.getByText(/Contribute your existing and future drop data/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Anonymously contribute/),
    ).not.toBeInTheDocument();
  });

  // ── Checkbox opt-in ──────────────────────────────────────────────────

  it("renders an unchecked checkbox by default", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    const checkbox = screen.getByRole("checkbox", { name: "I agree" });
    expect(checkbox).not.toBeChecked();
  });

  it("disables Contribute button when checkbox is unchecked", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    expect(screen.getByRole("button", { name: "Contribute" })).toBeDisabled();
  });

  it("enables Contribute button after checking the checkbox", async () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    const { user } = renderWithProviders(<BackfillBanner />);

    await user.click(screen.getByRole("checkbox"));

    expect(
      screen.getByRole("button", { name: "Contribute" }),
    ).not.toBeDisabled();
  });

  // ── Contribute action ────────────────────────────────────────────────

  it("delegates a confirmed contribution to the slice workflow", async () => {
    const triggerBackfill = vi.fn().mockResolvedValue(true);
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
        triggerBackfill,
      },
    });

    const { user } = renderWithProviders(<BackfillBanner />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Contribute" }));

    expect(triggerBackfill).toHaveBeenCalledTimes(1);
  });

  it("keeps the banner available when contribution fails", async () => {
    const triggerBackfill = vi.fn().mockResolvedValue(false);
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
        triggerBackfill,
      },
    });

    const { user } = renderWithProviders(<BackfillBanner />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Contribute" }));

    expect(triggerBackfill).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Contribute" })).toBeVisible();
  });

  it("shows a user-visible contribution error", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
        backfillError: "Community data could not be queued. Please try again.",
      },
    });

    renderWithProviders(<BackfillBanner />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Community data could not be queued. Please try again.",
    );
  });

  it("does not call triggerBackfill when checkbox is unchecked", () => {
    const triggerBackfill = vi.fn();
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
        triggerBackfill,
      },
    });

    renderWithProviders(<BackfillBanner />);

    // Button is disabled so we just assert it can't be triggered
    expect(screen.getByRole("button", { name: "Contribute" })).toBeDisabled();
    expect(triggerBackfill).not.toHaveBeenCalled();
  });

  // ── Loading state ────────────────────────────────────────────────────

  it("shows loading spinner and 'Uploading…' during backfill", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
        isBackfilling: true,
      },
    });

    renderWithProviders(<BackfillBanner />);

    expect(screen.getByText("Uploading…")).toBeInTheDocument();
    expect(screen.queryByText("Contribute")).not.toBeInTheDocument();
  });

  it("disables checkbox during backfill", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
        isBackfilling: true,
      },
    });

    renderWithProviders(<BackfillBanner />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("disables dismiss button during backfill", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
        isBackfilling: true,
      },
    });

    renderWithProviders(<BackfillBanner />);

    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });

  // ── Dismiss button style ─────────────────────────────────────────────

  it("renders a dismiss button with 'Dismiss' text label (not just an icon)", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });
    expect(dismissBtn).toBeInTheDocument();
    expect(dismissBtn).toHaveTextContent("Dismiss");
  });

  it("dismiss button has outline styling", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });
    expect(dismissBtn.className).toContain("btn-outline");
  });

  // ── Dismiss (persistent) ─────────────────────────────────────────────

  it("delegates persistent dismissal to the slice workflow", async () => {
    const dismissBackfillBanner = vi.fn().mockResolvedValue(true);
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
        dismissBackfillBanner,
      },
      banners: {
        loadStatus: "ready",
      },
    });

    const { user } = renderWithProviders(<BackfillBanner />);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(dismissBackfillBanner).toHaveBeenCalledTimes(1);
  });

  it("does not show a banner whose ID is in the dismissed set", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
      banners: {
        dismissedIds: new Set(["community-backfill"]),
        loadStatus: "ready",
      },
    });

    const { container } = renderWithProviders(<BackfillBanner />);

    expect(container.innerHTML).toBe("");
  });
});
