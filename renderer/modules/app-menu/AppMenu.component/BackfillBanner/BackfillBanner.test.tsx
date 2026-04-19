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
  FiX: (props: any) => <svg data-testid="x-icon" {...props} />,
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
      checkBackfill: vi.fn(),
      triggerBackfill: vi.fn(),
      dismissBackfill: vi.fn(),
      ...overrides.communityUpload,
    },
    banners: {
      dismissedIds: new Set<string>(),
      isLoaded: true,
      loadDismissed: vi.fn(),
      dismiss: vi.fn(),
      isDismissed: vi.fn().mockReturnValue(false),
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
        isDismissed: vi.fn().mockReturnValue(true),
        isLoaded: true,
      },
    });

    const { container } = renderWithProviders(<BackfillBanner />);

    expect(container.innerHTML).toBe("");
  });

  it("renders when banners are not yet loaded (isLoaded false) and leagues exist", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
      banners: {
        isDismissed: vi.fn().mockReturnValue(false),
        isLoaded: false,
      },
    });

    renderWithProviders(<BackfillBanner />);

    expect(
      screen.getByText(/existing and future drop data/),
    ).toBeInTheDocument();
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

  it("mentions 'existing and future' drop data", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    expect(
      screen.getByText(/existing and future drop data/),
    ).toBeInTheDocument();
  });

  // ── Checkbox opt-in ──────────────────────────────────────────────────

  it("renders an unchecked checkbox by default", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
    });

    renderWithProviders(<BackfillBanner />);

    const checkbox = screen.getByRole("checkbox");
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

  it("calls triggerBackfill when Contribute is clicked after opting in", async () => {
    const triggerBackfill = vi.fn();
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

  it("calls banners.dismiss and communityUpload.dismissBackfill when dismiss button is clicked", async () => {
    const dismissBackfill = vi.fn();
    const dismiss = vi.fn();
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
        dismissBackfill,
      },
      banners: {
        dismiss,
        isDismissed: vi.fn().mockReturnValue(false),
        isLoaded: true,
      },
    });

    const { user } = renderWithProviders(<BackfillBanner />);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    // Should call the banners slice dismiss with the correct banner ID
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith("community-backfill");

    // Should also call the community upload slice dismissBackfill for immediate UI feedback
    expect(dismissBackfill).toHaveBeenCalledTimes(1);
  });

  it("does not show banner when isDismissed returns true for community-backfill", () => {
    setupStore({
      communityUpload: {
        backfillLeagues: [{ game: "poe1", league: "Settlers" }],
      },
      banners: {
        isDismissed: vi.fn((id: string) => id === "community-backfill"),
        isLoaded: true,
      },
    });

    const { container } = renderWithProviders(<BackfillBanner />);

    expect(container.innerHTML).toBe("");
  });
});
