import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import ChartTooltip from "./ChartTooltip";

const validPayload = [
  {
    value: 1.23,
    dataKey: "rate",
    color: "#ff0000",
    payload: {
      time: 1704067200000,
      dateLabel: "Jan 1",
      rate: 1.23,
      volume: 45678,
    },
  },
];

describe("ChartTooltip", () => {
  it("returns null when inactive or missing payload", () => {
    const inactive = renderWithProviders(
      <ChartTooltip active={false} payload={validPayload} />,
    );
    expect(inactive.container.innerHTML).toBe("");

    const empty = renderWithProviders(
      <ChartTooltip active={true} payload={[]} />,
    );
    expect(empty.container.innerHTML).toBe("");
  });

  it("renders date, rate, and volume", () => {
    renderWithProviders(<ChartTooltip active={true} payload={validPayload} />);

    expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
    expect(screen.getByText(/1\.23/)).toBeInTheDocument();
    expect(screen.getByText(/45,678/)).toBeInTheDocument();
  });
});
