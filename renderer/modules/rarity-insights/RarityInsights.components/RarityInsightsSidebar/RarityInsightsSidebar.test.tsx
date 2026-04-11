import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import RarityInsightsDropdown from "./RarityInsightsSidebar";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("~/renderer/components", () => ({
  Button: ({ children, disabled, onClick, className, ...rest }: any) => (
    <button
      disabled={disabled}
      onClick={onClick}
      className={className}
      {...rest}
    >
      {children}
    </button>
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockToggleFilter = vi.fn();
const mockRescan = vi.fn().mockResolvedValue(undefined);

interface SetupStoreOptions {
  availableFilters?: Array<{
    id: string;
    name: string;
    type: "local" | "online";
    isOutdated?: boolean;
  }>;
  isScanning?: boolean;
  selectedFilters?: string[];
  parsedResults?: Map<string, unknown>;
  parsingFilterId?: string | null;
  parseErrors?: Map<string, string>;
  localFilters?: Array<{
    id: string;
    name: string;
    type: "local" | "online";
    isOutdated?: boolean;
  }>;
  onlineFilters?: Array<{
    id: string;
    name: string;
    type: "local" | "online";
    isOutdated?: boolean;
  }>;
}

function makeFilter(
  overrides: {
    id?: string;
    name?: string;
    type?: "local" | "online";
    isOutdated?: boolean;
  } = {},
) {
  return {
    id: overrides.id ?? "filter-1",
    name: overrides.name ?? "My Filter",
    type: overrides.type ?? "local",
    filePath: "/path/to/filter",
    fileName: "filter.filter",
    lastUpdate: null,
    isFullyParsed: false,
    isOutdated: overrides.isOutdated ?? false,
  };
}

function setupStore(overrides: SetupStoreOptions = {}) {
  const availableFilters = overrides.availableFilters ?? [];
  const localFilters =
    overrides.localFilters ??
    availableFilters.filter((f) => f.type === "local");
  const onlineFilters =
    overrides.onlineFilters ??
    availableFilters.filter((f) => f.type === "online");

  mockUseBoundStore.mockReturnValue({
    rarityInsights: {
      availableFilters,
      isScanning: overrides.isScanning ?? false,
      getLocalFilters: () => localFilters,
      getOnlineFilters: () => onlineFilters,
    },
    rarityInsightsComparison: {
      selectedFilters: overrides.selectedFilters ?? [],
      parsedResults: overrides.parsedResults ?? new Map(),
      parsingFilterId: overrides.parsingFilterId ?? null,
      parseErrors: overrides.parseErrors ?? new Map(),
      toggleFilter: mockToggleFilter,
      rescan: mockRescan,
    },
  } as any);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("RarityInsightsDropdown", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockToggleFilter.mockClear();
    mockRescan.mockClear();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the Filters button", () => {
      setupStore();
      renderWithProviders(<RarityInsightsDropdown />);

      expect(screen.getByText("Filters")).toBeInTheDocument();
    });

    it("does not show the dropdown content by default", () => {
      setupStore();
      renderWithProviders(<RarityInsightsDropdown />);

      expect(screen.queryByTestId("scan-section")).not.toBeInTheDocument();
    });

    it("Filters button is always enabled regardless of scanning state", () => {
      setupStore({ isScanning: true });
      renderWithProviders(<RarityInsightsDropdown />);

      const button = screen.getByText("Filters").closest("button");
      expect(button).not.toBeDisabled();
    });

    it("Filters button is enabled even when no filters are available", () => {
      setupStore({ availableFilters: [] });
      renderWithProviders(<RarityInsightsDropdown />);

      const button = screen.getByText("Filters").closest("button");
      expect(button).not.toBeDisabled();
    });

    it("enables the Filters button when filters exist and not scanning", () => {
      setupStore({
        availableFilters: [makeFilter()],
      });
      renderWithProviders(<RarityInsightsDropdown />);

      const button = screen.getByText("Filters").closest("button");
      expect(button).not.toBeDisabled();
    });
  });

  // ── Selected count badge ───────────────────────────────────────────────

  describe("selected count badge", () => {
    it("does not show a badge when no filters are selected", () => {
      setupStore({ availableFilters: [makeFilter()], selectedFilters: [] });
      renderWithProviders(<RarityInsightsDropdown />);

      const badge = screen.queryByText("0");
      expect(badge).not.toBeInTheDocument();
    });

    it("shows badge with count when filters are selected", () => {
      setupStore({
        availableFilters: [makeFilter({ id: "f1" }), makeFilter({ id: "f2" })],
        selectedFilters: ["f1", "f2"],
      });
      renderWithProviders(<RarityInsightsDropdown />);

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("shows badge with 1 when one filter is selected", () => {
      setupStore({
        availableFilters: [makeFilter({ id: "f1" })],
        selectedFilters: ["f1"],
      });
      renderWithProviders(<RarityInsightsDropdown />);

      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  // ── Toggle dropdown ────────────────────────────────────────────────────

  describe("toggle dropdown", () => {
    it("opens dropdown when Filters button is clicked", async () => {
      setupStore({
        availableFilters: [makeFilter({ id: "f1", name: "NeverSink" })],
        localFilters: [makeFilter({ id: "f1", name: "NeverSink" })],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.getByText(/Select up to/)).toBeInTheDocument();
      expect(screen.getByText("NeverSink")).toBeInTheDocument();
    });

    it("closes dropdown when Filters button is clicked again", async () => {
      setupStore({
        availableFilters: [makeFilter({ id: "f1", name: "NeverSink" })],
        localFilters: [makeFilter({ id: "f1", name: "NeverSink" })],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      // Open
      await user.click(screen.getByText("Filters").closest("button")!);
      expect(screen.getByText("NeverSink")).toBeInTheDocument();

      // Close
      await user.click(screen.getByText("Filters").closest("button")!);
      expect(screen.queryByText("NeverSink")).not.toBeInTheDocument();
    });

    it("shows Select up to 3 filters instruction when filters exist", async () => {
      setupStore({ availableFilters: [makeFilter()] });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.getByText(/Select up to 3 filters/)).toBeInTheDocument();
    });
  });

  // ── Click outside closes dropdown ──────────────────────────────────────

  describe("click outside", () => {
    it("closes dropdown when clicking outside", async () => {
      setupStore({
        availableFilters: [makeFilter({ id: "f1", name: "NeverSink" })],
        localFilters: [makeFilter({ id: "f1", name: "NeverSink" })],
      });
      const { user } = renderWithProviders(
        <div>
          <RarityInsightsDropdown />
          <button data-testid="outside-element">Outside</button>
        </div>,
      );

      // Open
      await user.click(screen.getByText("Filters").closest("button")!);
      expect(screen.getByText("NeverSink")).toBeInTheDocument();

      // Click outside
      await user.click(screen.getByTestId("outside-element"));

      expect(screen.queryByText("NeverSink")).not.toBeInTheDocument();
    });
  });

  // ── Scan section ───────────────────────────────────────────────────────

  describe("scan section", () => {
    it("renders the scan section when dropdown is open", async () => {
      setupStore({ availableFilters: [] });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.getByTestId("scan-section")).toBeInTheDocument();
    });

    it("has the data-onboarding attribute on the wrapper for beacon targeting", () => {
      setupStore({ availableFilters: [] });
      const { container } = renderWithProviders(<RarityInsightsDropdown />);

      // The data-onboarding attribute is on the always-visible wrapper div
      // (not inside the dropdown) so the beacon trigger can anchor to it
      // even when the dropdown is closed.
      const wrapper = container.querySelector(
        "[data-onboarding='rarity-insights-scan']",
      );
      expect(wrapper).toBeInTheDocument();
    });

    describe("before scan (no filters)", () => {
      it("renders the Scan Filters button", async () => {
        setupStore({ availableFilters: [], isScanning: false });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);

        expect(screen.getByTestId("scan-filters-button")).toBeInTheDocument();
        expect(screen.getByText("Scan Filters")).toBeInTheDocument();
      });

      it("renders a description prompting the user to scan", async () => {
        setupStore({ availableFilters: [], isScanning: false });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);

        expect(
          screen.getByText(/Scan your PoE filter files/),
        ).toBeInTheDocument();
      });

      it("calls rescan when Scan Filters is clicked", async () => {
        setupStore({ availableFilters: [], isScanning: false });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);
        await user.click(screen.getByTestId("scan-filters-button"));

        expect(mockRescan).toHaveBeenCalledTimes(1);
      });

      it("does not render filter groups when no filters exist", async () => {
        setupStore({ availableFilters: [], isScanning: false });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);

        expect(screen.queryByText("Online Filters")).not.toBeInTheDocument();
        expect(screen.queryByText("Local Filters")).not.toBeInTheDocument();
      });
    });

    describe("during scan", () => {
      it("renders the scanning indicator", async () => {
        setupStore({ availableFilters: [], isScanning: true });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);

        expect(screen.getByTestId("scanning-indicator")).toBeInTheDocument();
        expect(screen.getByText("Scanning...")).toBeInTheDocument();
      });

      it("does not render Scan Filters or Rescan buttons while scanning", async () => {
        setupStore({ availableFilters: [], isScanning: true });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);

        expect(
          screen.queryByTestId("scan-filters-button"),
        ).not.toBeInTheDocument();
        expect(screen.queryByTestId("rescan-button")).not.toBeInTheDocument();
      });
    });

    describe("after scan (filters exist)", () => {
      it("renders the Rescan button", async () => {
        setupStore({
          availableFilters: [makeFilter({ id: "f1", name: "NeverSink" })],
          localFilters: [makeFilter({ id: "f1", name: "NeverSink" })],
          isScanning: false,
        });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);

        expect(screen.getByTestId("rescan-button")).toBeInTheDocument();
        expect(screen.getByText("Rescan")).toBeInTheDocument();
      });

      it("renders the Select up to N filters instruction alongside Rescan", async () => {
        setupStore({
          availableFilters: [makeFilter()],
          isScanning: false,
        });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);

        expect(screen.getByText(/Select up to 3 filters/)).toBeInTheDocument();
        expect(screen.getByTestId("rescan-button")).toBeInTheDocument();
      });

      it("calls rescan when Rescan is clicked", async () => {
        setupStore({
          availableFilters: [makeFilter()],
          isScanning: false,
        });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);
        await user.click(screen.getByTestId("rescan-button"));

        expect(mockRescan).toHaveBeenCalledTimes(1);
      });

      it("does not render Scan Filters button when filters exist", async () => {
        setupStore({
          availableFilters: [makeFilter()],
          isScanning: false,
        });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);

        expect(
          screen.queryByTestId("scan-filters-button"),
        ).not.toBeInTheDocument();
      });
    });

    describe("scan guard", () => {
      it("does not call rescan when already scanning", async () => {
        // Edge case: isScanning is true but we somehow click — handleScan guards
        setupStore({
          availableFilters: [makeFilter()],
          isScanning: true,
        });
        const { user } = renderWithProviders(<RarityInsightsDropdown />);

        await user.click(screen.getByText("Filters").closest("button")!);

        // Scanning indicator is shown, Rescan button is hidden
        expect(screen.getByTestId("scanning-indicator")).toBeInTheDocument();
        expect(screen.queryByTestId("rescan-button")).not.toBeInTheDocument();

        // rescan should not have been called
        expect(mockRescan).not.toHaveBeenCalled();
      });
    });
  });

  // ── Filter groups ──────────────────────────────────────────────────────

  describe("filter groups", () => {
    it("renders Online Filters group when online filters exist", async () => {
      const onlineFilter = makeFilter({
        id: "o1",
        name: "Online Filter 1",
        type: "online",
      });
      setupStore({
        availableFilters: [onlineFilter],
        onlineFilters: [onlineFilter],
        localFilters: [],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.getByText("Online Filters")).toBeInTheDocument();
      expect(screen.getByText("Online Filter 1")).toBeInTheDocument();
    });

    it("renders Local Filters group when local filters exist", async () => {
      const localFilter = makeFilter({
        id: "l1",
        name: "Local Filter 1",
        type: "local",
      });
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        onlineFilters: [],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.getByText("Local Filters")).toBeInTheDocument();
      expect(screen.getByText("Local Filter 1")).toBeInTheDocument();
    });

    it("renders both groups when both online and local filters exist", async () => {
      const onlineFilter = makeFilter({
        id: "o1",
        name: "Online Filter",
        type: "online",
      });
      const localFilter = makeFilter({
        id: "l1",
        name: "Local Filter",
        type: "local",
      });
      setupStore({
        availableFilters: [onlineFilter, localFilter],
        onlineFilters: [onlineFilter],
        localFilters: [localFilter],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.getByText("Online Filters")).toBeInTheDocument();
      expect(screen.getByText("Online Filter")).toBeInTheDocument();
      expect(screen.getByText("Local Filters")).toBeInTheDocument();
      expect(screen.getByText("Local Filter")).toBeInTheDocument();
    });

    it("does not render Online Filters group when no online filters exist", async () => {
      const localFilter = makeFilter({
        id: "l1",
        name: "Local Only",
        type: "local",
      });
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        onlineFilters: [],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.queryByText("Online Filters")).not.toBeInTheDocument();
      expect(screen.getByText("Local Filters")).toBeInTheDocument();
    });

    it("does not render Local Filters group when no local filters exist", async () => {
      const onlineFilter = makeFilter({
        id: "o1",
        name: "Online Only",
        type: "online",
      });
      setupStore({
        availableFilters: [onlineFilter],
        onlineFilters: [onlineFilter],
        localFilters: [],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.getByText("Online Filters")).toBeInTheDocument();
      expect(screen.queryByText("Local Filters")).not.toBeInTheDocument();
    });
  });

  // ── Selecting filters ──────────────────────────────────────────────────

  describe("selecting filters", () => {
    it("calls toggleFilter when a filter is clicked", async () => {
      const localFilter = makeFilter({ id: "f1", name: "NeverSink" });
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);
      await user.click(screen.getByText("NeverSink"));

      expect(mockToggleFilter).toHaveBeenCalledWith("f1");
    });

    it("shows checkbox as checked for selected filters", async () => {
      const localFilter = makeFilter({ id: "f1", name: "NeverSink" });
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        selectedFilters: ["f1"],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });

    it("shows checkbox as unchecked for unselected filters", async () => {
      const localFilter = makeFilter({ id: "f1", name: "NeverSink" });
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        selectedFilters: [],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });
  });

  // ── Max selection limit ────────────────────────────────────────────────

  describe("max selection limit", () => {
    it("disables unselected filters when 3 filters are already selected", async () => {
      const filters = [
        makeFilter({ id: "f1", name: "Filter 1" }),
        makeFilter({ id: "f2", name: "Filter 2" }),
        makeFilter({ id: "f3", name: "Filter 3" }),
        makeFilter({ id: "f4", name: "Filter 4" }),
      ];
      setupStore({
        availableFilters: filters,
        localFilters: filters,
        selectedFilters: ["f1", "f2", "f3"],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      // Filter 4 should have cursor-not-allowed class (at max and not selected)
      const filter4Button = screen.getByText("Filter 4").closest("button");
      expect(filter4Button).toHaveClass("cursor-not-allowed");
    });

    it("does not call toggleFilter when clicking a disabled filter at max", async () => {
      const filters = [
        makeFilter({ id: "f1", name: "Filter 1" }),
        makeFilter({ id: "f2", name: "Filter 2" }),
        makeFilter({ id: "f3", name: "Filter 3" }),
        makeFilter({ id: "f4", name: "Filter 4" }),
      ];
      setupStore({
        availableFilters: filters,
        localFilters: filters,
        selectedFilters: ["f1", "f2", "f3"],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);
      await user.click(screen.getByText("Filter 4").closest("button")!);

      expect(mockToggleFilter).not.toHaveBeenCalled();
    });

    it("still allows toggling off selected filters when at max", async () => {
      const filters = [
        makeFilter({ id: "f1", name: "Filter 1" }),
        makeFilter({ id: "f2", name: "Filter 2" }),
        makeFilter({ id: "f3", name: "Filter 3" }),
      ];
      setupStore({
        availableFilters: filters,
        localFilters: filters,
        selectedFilters: ["f1", "f2", "f3"],
        parsingFilterId: null,
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);
      await user.click(screen.getByText("Filter 1").closest("button")!);

      expect(mockToggleFilter).toHaveBeenCalledWith("f1");
    });
  });

  // ── Disabled while parsing ─────────────────────────────────────────────

  describe("disabled while parsing", () => {
    it("does not call toggleFilter when parsingFilterId is set", async () => {
      const filters = [
        makeFilter({ id: "f1", name: "Filter 1" }),
        makeFilter({ id: "f2", name: "Filter 2" }),
      ];
      setupStore({
        availableFilters: filters,
        localFilters: filters,
        selectedFilters: ["f1"],
        parsingFilterId: "f1",
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);
      await user.click(screen.getByText("Filter 2").closest("button")!);

      expect(mockToggleFilter).not.toHaveBeenCalled();
    });
  });

  // ── Parsing spinner ────────────────────────────────────────────────────

  describe("parsing spinner", () => {
    it("shows a spinner for the filter currently being parsed", async () => {
      const localFilter = makeFilter({ id: "f1", name: "NeverSink" });
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        selectedFilters: ["f1"],
        parsingFilterId: "f1",
      });
      const { user, container } = renderWithProviders(
        <RarityInsightsDropdown />,
      );

      await user.click(screen.getByText("Filters").closest("button")!);

      const spinner = container.querySelector(".loading-spinner");
      expect(spinner).toBeInTheDocument();
    });

    it("does not show a spinner for filters not currently being parsed", async () => {
      const filters = [
        makeFilter({ id: "f1", name: "Filter 1" }),
        makeFilter({ id: "f2", name: "Filter 2" }),
      ];
      setupStore({
        availableFilters: filters,
        localFilters: filters,
        selectedFilters: ["f1", "f2"],
        parsingFilterId: "f1",
      });
      const { user, container } = renderWithProviders(
        <RarityInsightsDropdown />,
      );

      await user.click(screen.getByText("Filters").closest("button")!);

      // Only one spinner should exist (for f1)
      const spinners = container.querySelectorAll(".loading-spinner");
      expect(spinners).toHaveLength(1);
    });
  });

  // ── Parsed checkmark ──────────────────────────────────────────────────

  describe("parsed checkmark", () => {
    it("shows a checkmark for filters that have been parsed", async () => {
      const localFilter = makeFilter({ id: "f1", name: "NeverSink" });
      const parsedResults = new Map([["f1", { filterId: "f1" }]]);
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        selectedFilters: ["f1"],
        parsedResults,
        parsingFilterId: null,
      });
      const { user, container } = renderWithProviders(
        <RarityInsightsDropdown />,
      );

      await user.click(screen.getByText("Filters").closest("button")!);

      // FiCheck renders as an SVG — look for the success-colored icon
      const checkIcon = container.querySelector(".text-success");
      expect(checkIcon).toBeInTheDocument();
    });

    it("does not show checkmark while the filter is currently parsing", async () => {
      const localFilter = makeFilter({ id: "f1", name: "NeverSink" });
      const parsedResults = new Map([["f1", { filterId: "f1" }]]);
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        selectedFilters: ["f1"],
        parsedResults,
        parsingFilterId: "f1", // currently parsing — spinner takes precedence
      });
      const { user, container } = renderWithProviders(
        <RarityInsightsDropdown />,
      );

      await user.click(screen.getByText("Filters").closest("button")!);

      // Should show spinner instead of check
      expect(container.querySelector(".loading-spinner")).toBeInTheDocument();
      expect(container.querySelector(".text-success")).not.toBeInTheDocument();
    });
  });

  // ── Error icon ─────────────────────────────────────────────────────────

  describe("error icon", () => {
    it("shows an error icon for filters with parse errors", async () => {
      const localFilter = makeFilter({ id: "f1", name: "NeverSink" });
      const parseErrors = new Map([["f1", "Failed to parse"]]);
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        selectedFilters: ["f1"],
        parseErrors,
        parsingFilterId: null,
      });
      const { user, container } = renderWithProviders(
        <RarityInsightsDropdown />,
      );

      await user.click(screen.getByText("Filters").closest("button")!);

      const errorIcon = container.querySelector(".text-error");
      expect(errorIcon).toBeInTheDocument();
    });

    it("shows the error message in a tooltip", async () => {
      const localFilter = makeFilter({ id: "f1", name: "NeverSink" });
      const parseErrors = new Map([["f1", "Failed to parse filter"]]);
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        selectedFilters: ["f1"],
        parseErrors,
        parsingFilterId: null,
      });
      const { user, container } = renderWithProviders(
        <RarityInsightsDropdown />,
      );

      await user.click(screen.getByText("Filters").closest("button")!);

      const tooltip = container.querySelector(
        "[data-tip='Failed to parse filter']",
      );
      expect(tooltip).toBeInTheDocument();
    });

    it("does not show error icon while the filter is currently parsing", async () => {
      const localFilter = makeFilter({ id: "f1", name: "NeverSink" });
      const parseErrors = new Map([["f1", "Some error"]]);
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
        selectedFilters: ["f1"],
        parseErrors,
        parsingFilterId: "f1",
      });
      const { user, container } = renderWithProviders(
        <RarityInsightsDropdown />,
      );

      await user.click(screen.getByText("Filters").closest("button")!);

      // Should show spinner, not error
      expect(container.querySelector(".loading-spinner")).toBeInTheDocument();
      expect(container.querySelector(".text-error")).not.toBeInTheDocument();
    });
  });

  // ── Outdated badge ─────────────────────────────────────────────────────

  describe("outdated filters", () => {
    it("shows (outdated) text for outdated filters", async () => {
      const localFilter = makeFilter({
        id: "f1",
        name: "Old Filter",
        isOutdated: true,
      });
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.getByText("(outdated)")).toBeInTheDocument();
    });

    it("does not show (outdated) text for current filters", async () => {
      const localFilter = makeFilter({
        id: "f1",
        name: "Current Filter",
        isOutdated: false,
      });
      setupStore({
        availableFilters: [localFilter],
        localFilters: [localFilter],
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.queryByText("(outdated)")).not.toBeInTheDocument();
    });
  });

  // ── Empty state ────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows warning message and Scan Filters button when no filters and not scanning", async () => {
      setupStore({ availableFilters: [], isScanning: false });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      // The Filters button is now always enabled so we can open the dropdown
      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.getByText(/No filters found/)).toBeInTheDocument();
      expect(
        screen.getByText(/Use Scan Filters above to search/),
      ).toBeInTheDocument();
      expect(screen.getByTestId("scan-filters-button")).toBeInTheDocument();
    });

    it("does not show warning message when scanning", async () => {
      setupStore({ availableFilters: [], isScanning: true });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.queryByText(/No filters found/)).not.toBeInTheDocument();
      expect(screen.getByText("Scanning...")).toBeInTheDocument();
    });

    it("does not show warning message when filters exist", async () => {
      setupStore({
        availableFilters: [makeFilter()],
        isScanning: false,
      });
      const { user } = renderWithProviders(<RarityInsightsDropdown />);

      await user.click(screen.getByText("Filters").closest("button")!);

      expect(screen.queryByText(/No filters found/)).not.toBeInTheDocument();
    });
  });
});
