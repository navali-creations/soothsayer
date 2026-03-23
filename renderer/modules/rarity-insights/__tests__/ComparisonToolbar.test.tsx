import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import ComparisonToolbar from "../RarityInsights.components/ComparisonToolbar";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockSetShowDiffsOnly = vi.fn();
const mockSetIncludeBossCards = vi.fn();

function setupStore(
  overrides: {
    showDiffsOnly?: boolean;
    includeBossCards?: boolean;
    canShowDiffs?: boolean;
    allSelectedParsed?: boolean;
    differences?: Set<string>;
  } = {},
) {
  mockUseBoundStore.mockReturnValue({
    rarityInsightsComparison: {
      showDiffsOnly: overrides.showDiffsOnly ?? false,
      setShowDiffsOnly: mockSetShowDiffsOnly,
      includeBossCards: overrides.includeBossCards ?? false,
      setIncludeBossCards: mockSetIncludeBossCards,
      getCanShowDiffs: () => overrides.canShowDiffs ?? false,
      getAllSelectedParsed: () => overrides.allSelectedParsed ?? false,
      getDifferences: () => overrides.differences ?? new Set<string>(),
    },
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ComparisonToolbar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the Include boss cards checkbox", () => {
      setupStore();
      renderWithProviders(<ComparisonToolbar />);

      expect(screen.getByText("Include boss cards")).toBeInTheDocument();
    });

    it("renders the Show differences only checkbox", () => {
      setupStore();
      renderWithProviders(<ComparisonToolbar />);

      expect(screen.getByText(/Show differences only/)).toBeInTheDocument();
    });

    it("renders two checkboxes", () => {
      setupStore();
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2);
    });
  });

  // ── Include boss cards checkbox ────────────────────────────────────────

  describe("Include boss cards checkbox", () => {
    it("is unchecked when includeBossCards is false", () => {
      setupStore({ includeBossCards: false });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      // Boss cards checkbox is the first one
      expect(checkboxes[0]).not.toBeChecked();
    });

    it("is checked when includeBossCards is true", () => {
      setupStore({ includeBossCards: true });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).toBeChecked();
    });

    it("is always enabled regardless of diffs state", () => {
      setupStore({ canShowDiffs: false, allSelectedParsed: false });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).not.toBeDisabled();
    });

    it("calls setIncludeBossCards(true) when toggled on", async () => {
      setupStore({ includeBossCards: false });
      const { user } = renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(mockSetIncludeBossCards).toHaveBeenCalledWith(true);
    });

    it("calls setIncludeBossCards(false) when toggled off", async () => {
      setupStore({ includeBossCards: true });
      const { user } = renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(mockSetIncludeBossCards).toHaveBeenCalledWith(false);
    });
  });

  // ── Show differences only checkbox ─────────────────────────────────────

  describe("Show differences only checkbox", () => {
    it("is disabled when canShowDiffs is false", () => {
      setupStore({ canShowDiffs: false, allSelectedParsed: true });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[1]).toBeDisabled();
    });

    it("is disabled when allSelectedParsed is false", () => {
      setupStore({ canShowDiffs: true, allSelectedParsed: false });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[1]).toBeDisabled();
    });

    it("is disabled when both canShowDiffs and allSelectedParsed are false", () => {
      setupStore({ canShowDiffs: false, allSelectedParsed: false });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[1]).toBeDisabled();
    });

    it("is enabled when canShowDiffs and allSelectedParsed are both true", () => {
      setupStore({ canShowDiffs: true, allSelectedParsed: true });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[1]).not.toBeDisabled();
    });

    it("is unchecked when showDiffsOnly is false", () => {
      setupStore({
        showDiffsOnly: false,
        canShowDiffs: true,
        allSelectedParsed: true,
      });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[1]).not.toBeChecked();
    });

    it("is checked when showDiffsOnly is true", () => {
      setupStore({
        showDiffsOnly: true,
        canShowDiffs: true,
        allSelectedParsed: true,
      });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[1]).toBeChecked();
    });

    it("calls setShowDiffsOnly(true) when toggled on", async () => {
      setupStore({
        showDiffsOnly: false,
        canShowDiffs: true,
        allSelectedParsed: true,
      });
      const { user } = renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      expect(mockSetShowDiffsOnly).toHaveBeenCalledWith(true);
    });

    it("calls setShowDiffsOnly(false) when toggled off", async () => {
      setupStore({
        showDiffsOnly: true,
        canShowDiffs: true,
        allSelectedParsed: true,
      });
      const { user } = renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      expect(mockSetShowDiffsOnly).toHaveBeenCalledWith(false);
    });

    it("has the checkbox disabled so the user cannot toggle it", () => {
      setupStore({
        showDiffsOnly: false,
        canShowDiffs: false,
        allSelectedParsed: false,
      });
      renderWithProviders(<ComparisonToolbar />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[1]).toBeDisabled();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  // ── Diff count badge ───────────────────────────────────────────────────

  describe("diff count badge", () => {
    it("shows diff count when diffs are enabled and differences exist", () => {
      setupStore({
        canShowDiffs: true,
        allSelectedParsed: true,
        differences: new Set(["Card A", "Card B", "Card C"]),
      });
      renderWithProviders(<ComparisonToolbar />);

      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    it("does not show diff count when differences is empty", () => {
      setupStore({
        canShowDiffs: true,
        allSelectedParsed: true,
        differences: new Set(),
      });
      renderWithProviders(<ComparisonToolbar />);

      expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
    });

    it("does not show diff count when diffs are not enabled (canShowDiffs false)", () => {
      setupStore({
        canShowDiffs: false,
        allSelectedParsed: true,
        differences: new Set(["Card A"]),
      });
      renderWithProviders(<ComparisonToolbar />);

      expect(screen.queryByText("(1)")).not.toBeInTheDocument();
    });

    it("does not show diff count when not all selected are parsed", () => {
      setupStore({
        canShowDiffs: true,
        allSelectedParsed: false,
        differences: new Set(["Card A"]),
      });
      renderWithProviders(<ComparisonToolbar />);

      expect(screen.queryByText("(1)")).not.toBeInTheDocument();
    });

    it("shows correct count for a single difference", () => {
      setupStore({
        canShowDiffs: true,
        allSelectedParsed: true,
        differences: new Set(["Card A"]),
      });
      renderWithProviders(<ComparisonToolbar />);

      expect(screen.getByText("(1)")).toBeInTheDocument();
    });
  });

  // ── Visual disabled state ──────────────────────────────────────────────

  describe("disabled visual state", () => {
    it("applies opacity-50 class to show diffs label when disabled", () => {
      setupStore({ canShowDiffs: false, allSelectedParsed: false });
      renderWithProviders(<ComparisonToolbar />);

      const showDiffsLabel = screen
        .getByText(/Show differences only/)
        .closest("label");
      expect(showDiffsLabel).toHaveClass("cursor-not-allowed");
      expect(showDiffsLabel).toHaveClass("opacity-50");
    });

    it("applies cursor-pointer class to show diffs label when enabled", () => {
      setupStore({ canShowDiffs: true, allSelectedParsed: true });
      renderWithProviders(<ComparisonToolbar />);

      const showDiffsLabel = screen
        .getByText(/Show differences only/)
        .closest("label");
      expect(showDiffsLabel).toHaveClass("cursor-pointer");
      expect(showDiffsLabel).not.toHaveClass("cursor-not-allowed");
    });
  });
});
