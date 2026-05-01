import { fireEvent } from "@testing-library/react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { ChartLegend } from "./ChartLegend";

describe("ChartLegend", () => {
  it("renders static legend items with labels", () => {
    renderWithProviders(
      <ChartLegend
        items={[
          {
            id: "bars",
            label: "Drops / Day",
            visual: "bar",
            color: "#ff00ff",
          },
          {
            id: "line",
            label: "Cumulative Drops",
            visual: "line",
            color: "#ff00ff",
          },
        ]}
      />,
    );

    expect(screen.getByText("Drops / Day")).toBeInTheDocument();
    expect(screen.getByText("Cumulative Drops")).toBeInTheDocument();
  });

  it("renders clickable legend item as button and respects hidden state", () => {
    const onClick = vi.fn();
    renderWithProviders(
      <ChartLegend
        items={[
          {
            id: "decks",
            label: "Decks Opened",
            visual: "scatter",
            color: "#00ff00",
            hidden: true,
            onClick,
          },
        ]}
      />,
    );

    const button = screen.getByText("Decks Opened").closest("button");
    expect(button).toBeInTheDocument();
    expect(button?.className).toContain("opacity-30");

    fireEvent.click(button!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
