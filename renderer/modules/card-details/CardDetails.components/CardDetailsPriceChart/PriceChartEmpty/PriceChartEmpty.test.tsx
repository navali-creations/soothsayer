import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import PriceChartEmpty from "./PriceChartEmpty";

describe("PriceChartEmpty", () => {
  it("renders the heading and empty message", () => {
    renderWithProviders(<PriceChartEmpty />);

    expect(screen.getByText("Price History")).toBeInTheDocument();
    expect(
      screen.getByText("No price history available for this card."),
    ).toBeInTheDocument();
  });
});
