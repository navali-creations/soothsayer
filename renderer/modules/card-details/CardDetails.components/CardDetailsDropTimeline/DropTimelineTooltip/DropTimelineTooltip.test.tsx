import {
  renderWithProviders,
  screen,
  within,
} from "~/renderer/__test-setup__/render";

import type { ChartDataPoint } from "../types";
import DropTimelineTooltip from "./DropTimelineTooltip";

function makeDataPoint(
  overrides: Partial<ChartDataPoint> = {},
): ChartDataPoint {
  return {
    time: 1704067200000,
    count: 3,
    cumulativeCount: 10,
    totalDecksOpened: 500,
    league: "Affliction",
    sessionStartedAt: "2024-01-01T12:00:00.000Z",
    sessionId: "session-1",
    sessionCount: 1,
    ...overrides,
  };
}

describe("DropTimelineTooltip", () => {
  it("returns null when the data point is missing or synthetic", () => {
    const missing = renderWithProviders(
      <DropTimelineTooltip dataPoint={null} />,
    );
    expect(missing.container.innerHTML).toBe("");

    const gap = renderWithProviders(
      <DropTimelineTooltip dataPoint={makeDataPoint({ isGap: true })} />,
    );
    expect(gap.container.innerHTML).toBe("");

    const boundary = renderWithProviders(
      <DropTimelineTooltip dataPoint={makeDataPoint({ isBoundary: true })} />,
    );
    expect(boundary.container.innerHTML).toBe("");
  });

  it("renders date header with league badge and core metrics", () => {
    renderWithProviders(
      <DropTimelineTooltip
        dataPoint={makeDataPoint()}
        metrics={{ anticipatedDrops: 1.8 }}
      />,
    );

    expect(screen.getByText("Affliction")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("500 decks")).toBeInTheDocument();
    expect(screen.getByText("1 session")).toBeInTheDocument();
    expect(screen.queryByText("League")).not.toBeInTheDocument();
    expect(screen.getByText("Dropped")).toBeInTheDocument();
    expect(screen.getByText("Expected")).toBeInTheDocument();
    expect(screen.queryByText("Expected to Drop")).not.toBeInTheDocument();
  });

  it("renders sessions in footer chip with singular/plural formatting", () => {
    const { unmount } = renderWithProviders(
      <DropTimelineTooltip dataPoint={makeDataPoint({ sessionCount: 1 })} />,
    );
    expect(screen.getByText("1 session")).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <DropTimelineTooltip dataPoint={makeDataPoint({ sessionCount: 4 })} />,
    );
    expect(screen.getByText("4 sessions")).toBeInTheDocument();
  });

  it("colors dropped value by dropped vs expected comparison", () => {
    const under = renderWithProviders(
      <DropTimelineTooltip
        dataPoint={makeDataPoint({ count: 1 })}
        metrics={{ anticipatedDrops: 2.2 }}
      />,
    );
    const underRow = screen.getByText("Dropped").closest("div");
    expect(underRow).not.toBeNull();
    expect(within(underRow as HTMLElement).getByText("1")).toHaveClass(
      "text-error",
    );
    under.unmount();

    renderWithProviders(
      <DropTimelineTooltip
        dataPoint={makeDataPoint({ count: 3 })}
        metrics={{ anticipatedDrops: 2.2 }}
      />,
    );
    const metRow = screen.getByText("Dropped").closest("div");
    expect(metRow).not.toBeNull();
    expect(within(metRow as HTMLElement).getByText("3")).toHaveClass(
      "text-success",
    );
    const expectedRow = screen.getByText("Expected").closest("div");
    expect(expectedRow).not.toBeNull();
    expect(within(expectedRow as HTMLElement).getByText("2")).toHaveClass(
      "text-base-content",
    );
  });

  it("colors dropped value as met when it matches the rounded expected value", () => {
    renderWithProviders(
      <DropTimelineTooltip
        dataPoint={makeDataPoint({ count: 3 })}
        metrics={{ anticipatedDrops: 3.4 }}
      />,
    );

    const droppedRow = screen.getByText("Dropped").closest("div");
    expect(droppedRow).not.toBeNull();
    expect(within(droppedRow as HTMLElement).getByText("3")).toHaveClass(
      "text-success",
    );
    expect(screen.getByText("Expected")).toBeInTheDocument();
  });

  it("keeps dropped value neutral when both dropped and expected are zero", () => {
    renderWithProviders(
      <DropTimelineTooltip
        dataPoint={makeDataPoint({ count: 0, totalDecksOpened: 0 })}
        metrics={{ anticipatedDrops: 0 }}
      />,
    );

    const droppedRow = screen.getByText("Dropped").closest("div");
    expect(droppedRow).not.toBeNull();
    expect(within(droppedRow as HTMLElement).getByText("0")).toHaveClass(
      "text-base-content",
    );
    expect(within(droppedRow as HTMLElement).getByText("0")).not.toHaveClass(
      "text-success",
    );
  });
});
