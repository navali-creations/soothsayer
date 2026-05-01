import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import PriceChartError from "./PriceChartError";

vi.mock("react-icons/fi", () => ({
  FiAlertCircle: (props: any) => <span data-testid="fi-alert" {...props} />,
}));

describe("PriceChartError", () => {
  it("renders the heading, error message, and alert icon", () => {
    renderWithProviders(<PriceChartError />);

    expect(screen.getByText("Price History")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Failed to load price history. poe.ninja may be unreachable.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("fi-alert")).toBeInTheDocument();
  });
});
