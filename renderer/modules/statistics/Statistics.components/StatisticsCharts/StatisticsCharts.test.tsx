import { fireEvent } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { StatisticsCharts } from "./StatisticsCharts";

const useBoundStore = vi.fn() as any;
vi.mock("~/renderer/store", () => ({
  useBoundStore: (...args: any[]) => useBoundStore(...args),
}));

vi.mock("~/renderer/hooks", () => ({
  useChartColors: () => ({
    secondary: "rgb(100,100,100)",
    secondary30: "rgba(100,100,100,0.3)",
    primary: "rgb(200,200,200)",
    success: "rgb(0,200,0)",
    warning: "rgb(200,200,0)",
    bc06: "rgba(0,0,0,0.06)",
    bc10: "rgba(0,0,0,0.1)",
    bc15: "rgba(0,0,0,0.15)",
    bc20: "rgba(0,0,0,0.2)",
    bc30: "rgba(0,0,0,0.3)",
    bc40: "rgba(0,0,0,0.4)",
    b2: "rgb(30,30,30)",
  }),
}));

vi.mock("~/renderer/components/CombinedChartCanvas", () => ({
  CombinedChartCanvas: (props: any) => (
    <div data-testid="canvas-chart" data-stat-scope={props.statScope} />
  ),
}));

const mockRawChartData = [
  {
    sessionIndex: 1,
    sessionDate: "2024-01-01",
    league: "Test",
    durationMinutes: 30,
    totalDecksOpened: 10,
    exchangeNetProfit: 100,
    chaosPerDivine: 200,
  },
  {
    sessionIndex: 2,
    sessionDate: "2024-01-02",
    league: "Test",
    durationMinutes: 45,
    totalDecksOpened: 15,
    exchangeNetProfit: 200,
    chaosPerDivine: 200,
  },
];

function setupStore(
  overrides: {
    statScope?: "all-time" | "league";
    selectedLeague?: string;
    chartRawData?: typeof mockRawChartData;
    isChartLoading?: boolean;
    hiddenMetrics?: Set<string>;
    brushRange?: { startIndex: number; endIndex: number };
  } = {},
) {
  const fetchChartData = vi.fn();
  const toggleChartMetric = vi.fn();
  const setBrushRange = vi.fn();

  useBoundStore.mockReturnValue({
    statistics: {
      statScope: overrides.statScope ?? "all-time",
      selectedLeague: overrides.selectedLeague ?? "",
      chartRawData: overrides.chartRawData ?? [],
      isChartLoading: overrides.isChartLoading ?? false,
      hiddenMetrics: overrides.hiddenMetrics ?? new Set(),
      brushRange: overrides.brushRange ?? { startIndex: 0, endIndex: 0 },
      fetchChartData,
      toggleChartMetric,
      setBrushRange,
    },
  });

  return { fetchChartData, toggleChartMetric, setBrushRange };
}

describe("StatisticsCharts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loading overlay", () => {
    it("shows loading overlay when chart data is still loading", () => {
      setupStore({ chartRawData: mockRawChartData, isChartLoading: true });

      const { container } = renderWithProviders(
        <StatisticsCharts isDataLoading={false} />,
      );

      expect(screen.getByTestId("canvas-chart")).toBeInTheDocument();
      const overlay = container.querySelector(".backdrop-blur-\\[1px\\]");
      expect(overlay).toHaveClass("opacity-100");
      const spinner = container.querySelector(".loading.loading-spinner");
      expect(spinner).toBeTruthy();
    });

    it("shows loading overlay when isDataLoading is true even after chart loads", () => {
      setupStore({ chartRawData: mockRawChartData, isChartLoading: false });

      const { container } = renderWithProviders(
        <StatisticsCharts isDataLoading={true} />,
      );

      expect(screen.getByTestId("canvas-chart")).toBeInTheDocument();
      const overlay = container.querySelector(".backdrop-blur-\\[1px\\]");
      expect(overlay).toBeTruthy();
      expect(overlay).toHaveClass("opacity-100");
    });

    it("does not show loading overlay when data is loaded and isDataLoading is false", () => {
      setupStore({ chartRawData: mockRawChartData, isChartLoading: false });

      const { container } = renderWithProviders(
        <StatisticsCharts isDataLoading={false} />,
      );

      expect(screen.getByTestId("canvas-chart")).toBeInTheDocument();
      const overlay = container.querySelector(".backdrop-blur-\\[1px\\]");
      expect(overlay).toHaveClass("opacity-0");
    });
  });

  describe("empty state", () => {
    it("shows empty state when fewer than 2 sessions", () => {
      setupStore({ chartRawData: [mockRawChartData[0]] });

      renderWithProviders(<StatisticsCharts />);

      expect(
        screen.getByText(/at least 2 completed sessions/i),
      ).toBeInTheDocument();
    });

    it("shows empty state when chart data is empty", () => {
      setupStore({ chartRawData: [] });

      renderWithProviders(<StatisticsCharts />);

      expect(
        screen.getByText(/at least 2 completed sessions/i),
      ).toBeInTheDocument();
    });
  });

  describe("chart rendering", () => {
    it("renders chart when data has 2+ sessions", () => {
      setupStore({ chartRawData: mockRawChartData });

      renderWithProviders(<StatisticsCharts />);

      expect(screen.getByTestId("canvas-chart")).toBeInTheDocument();
    });

    it("renders Session Overview heading", () => {
      setupStore({ chartRawData: mockRawChartData });

      renderWithProviders(<StatisticsCharts />);

      expect(screen.getByText("Session Overview")).toBeInTheDocument();
    });
  });

  describe("statScope prop forwarding", () => {
    it("passes all-time scope to canvas chart", () => {
      setupStore({ statScope: "all-time", chartRawData: mockRawChartData });

      renderWithProviders(<StatisticsCharts />);

      const chart = screen.getByTestId("canvas-chart");
      expect(chart).toHaveAttribute("data-stat-scope", "all-time");
    });

    it("passes league scope to canvas chart", () => {
      setupStore({
        statScope: "league",
        selectedLeague: "Test",
        chartRawData: mockRawChartData,
      });

      renderWithProviders(<StatisticsCharts />);

      const chart = screen.getByTestId("canvas-chart");
      expect(chart).toHaveAttribute("data-stat-scope", "league");
    });
  });

  describe("legend buttons", () => {
    it("renders legend buttons for all metrics", () => {
      setupStore({ chartRawData: mockRawChartData });

      renderWithProviders(<StatisticsCharts />);

      expect(screen.getByText("Decks Opened")).toBeInTheDocument();
      expect(screen.getByText("Profit")).toBeInTheDocument();
    });

    it("calls toggleChartMetric when legend button is clicked", () => {
      const { toggleChartMetric } = setupStore({
        chartRawData: mockRawChartData,
      });

      renderWithProviders(<StatisticsCharts />);

      const decksButton = screen.getByText("Decks Opened").closest("button")!;
      fireEvent.click(decksButton);

      expect(toggleChartMetric).toHaveBeenCalledWith("decks");
    });

    it("applies dimmed opacity class when metric is hidden", () => {
      setupStore({
        chartRawData: mockRawChartData,
        hiddenMetrics: new Set(["decks"]),
      });

      renderWithProviders(<StatisticsCharts />);

      const decksButton = screen.getByText("Decks Opened").closest("button")!;
      expect(decksButton.className).toContain("opacity-30");
    });

    it("applies full opacity class when metric is visible", () => {
      setupStore({
        chartRawData: mockRawChartData,
        hiddenMetrics: new Set(),
      });

      renderWithProviders(<StatisticsCharts />);

      const decksButton = screen.getByText("Decks Opened").closest("button")!;
      expect(decksButton.className).toContain("opacity-100");
    });
  });

  describe("data fetching", () => {
    it("calls fetchChartData on mount", () => {
      const { fetchChartData } = setupStore({ statScope: "all-time" });

      renderWithProviders(<StatisticsCharts />);

      expect(fetchChartData).toHaveBeenCalledWith("poe1", undefined);
    });

    it("calls fetchChartData with league when in league scope", () => {
      const { fetchChartData } = setupStore({
        statScope: "league",
        selectedLeague: "Settlers",
      });

      renderWithProviders(<StatisticsCharts />);

      expect(fetchChartData).toHaveBeenCalledWith("poe1", "Settlers");
    });

    it("calls fetchChartData without league when in all-time scope", () => {
      const { fetchChartData } = setupStore({
        statScope: "all-time",
        selectedLeague: "Settlers",
      });

      renderWithProviders(<StatisticsCharts />);

      expect(fetchChartData).toHaveBeenCalledWith("poe1", undefined);
    });
  });

  describe("brush range", () => {
    it("calls setBrushRange with default range on data change", () => {
      const { setBrushRange } = setupStore({
        chartRawData: mockRawChartData,
      });

      renderWithProviders(<StatisticsCharts />);

      expect(setBrushRange).toHaveBeenCalledWith({
        startIndex: 0,
        endIndex: 1,
      });
    });
  });
});
