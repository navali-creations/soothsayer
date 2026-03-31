import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type { ProfitPerHourHighlight } from "../../../Statistics.types";
import { StatsProfitPerHour } from "./StatsProfitPerHour";

vi.mock("~/renderer/components", () => ({
  Stat: Object.assign(
    ({ children, ...props }: any) => (
      <div data-testid="stat" {...props}>
        {children}
      </div>
    ),
    {
      Title: ({ children, ...props }: any) => (
        <div data-testid="stat-title" {...props}>
          {children}
        </div>
      ),
      Value: ({ children, ...props }: any) => (
        <div data-testid="stat-value" {...props}>
          {children}
        </div>
      ),
      Desc: ({ children, ...props }: any) => (
        <div data-testid="stat-desc" {...props}>
          {children}
        </div>
      ),
      Figure: ({ children, ...props }: any) => (
        <div data-testid="stat-figure" {...props}>
          {children}
        </div>
      ),
    },
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiInfo: (props: any) => <svg data-testid="icon-info" {...props} />,
}));

function createData(
  overrides: Partial<ProfitPerHourHighlight> = {},
): ProfitPerHourHighlight {
  return {
    profitPerHour: 0,
    avgChaosPerDivine: 0,
    ...overrides,
  };
}

describe("StatsProfitPerHour", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Profit Per Hour" title', () => {
    renderWithProviders(<StatsProfitPerHour data={null} />);

    expect(screen.getByTestId("stat-title")).toHaveTextContent(
      "Profit Per Hour",
    );
  });

  it('shows "N/A" when data is null', () => {
    renderWithProviders(<StatsProfitPerHour data={null} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("N/A");
  });

  it('shows "No sessions yet" when data is null', () => {
    renderWithProviders(<StatsProfitPerHour data={null} />);

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("shows profit in divines when avgChaosPerDivine > 0", () => {
    const data = createData({
      profitPerHour: 500,
      avgChaosPerDivine: 200,
    });

    renderWithProviders(<StatsProfitPerHour data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+2.5div/hr");
  });

  it("shows profit in chaos when avgChaosPerDivine is 0", () => {
    const data = createData({
      profitPerHour: 500,
      avgChaosPerDivine: 0,
    });

    renderWithProviders(<StatsProfitPerHour data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+500c/hr");
  });

  it("shows positive profit with + prefix", () => {
    const data = createData({
      profitPerHour: 300,
      avgChaosPerDivine: 100,
    });

    renderWithProviders(<StatsProfitPerHour data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("+3.0div/hr");
  });

  it("shows negative profit without + prefix", () => {
    const data = createData({
      profitPerHour: -200,
      avgChaosPerDivine: 200,
    });

    renderWithProviders(<StatsProfitPerHour data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("-1.0div/hr");
  });

  it("formats large chaos values with locale separators", () => {
    const data = createData({
      profitPerHour: -12345,
      avgChaosPerDivine: 0,
    });

    renderWithProviders(<StatsProfitPerHour data={data} />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("-12,345c/hr");
  });

  it("renders info tooltip icon", () => {
    renderWithProviders(<StatsProfitPerHour data={null} />);

    expect(screen.getByTestId("icon-info")).toBeInTheDocument();
  });
});
