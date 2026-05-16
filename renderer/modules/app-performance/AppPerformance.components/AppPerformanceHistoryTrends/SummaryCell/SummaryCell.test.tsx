import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { SummaryCell } from "./SummaryCell";

describe("SummaryCell", () => {
  it("renders the primary formatted value", () => {
    renderWithProviders(
      <SummaryCell
        label="Avg"
        value={42}
        secondaryValue={null}
        format={(value) => `${value ?? "n/a"} fps`}
      />,
    );

    expect(screen.getByText("Avg")).toBeInTheDocument();
    expect(screen.getByText("42 fps")).toBeInTheDocument();
  });

  it("renders a finite secondary value with an optional label", () => {
    renderWithProviders(
      <SummaryCell
        label="Avg"
        value={1024}
        secondaryValue={2.4}
        format={(value) => `${value ?? "n/a"} MB`}
        secondaryFormat={(value) => `${value ?? "n/a"}%`}
        secondaryLabel="RAM"
      />,
    );

    expect(screen.getByText("2.4% RAM")).toBeInTheDocument();
  });

  it("hides secondary values when they are missing or non-finite", () => {
    const { rerender } = renderWithProviders(
      <SummaryCell
        label="Avg"
        value={1024}
        secondaryValue={Number.NaN}
        format={(value) => `${value ?? "n/a"} MB`}
        secondaryFormat={(value) => `${value ?? "n/a"}%`}
      />,
    );

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    rerender(
      <SummaryCell
        label="Avg"
        value={1024}
        secondaryValue={2.4}
        format={(value) => `${value ?? "n/a"} MB`}
      />,
    );

    expect(screen.queryByText("2.4%")).not.toBeInTheDocument();
  });
});
