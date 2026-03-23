import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import LoadingAlert from "./LoadingAlert";

describe("LoadingAlert", () => {
  it("renders an alert container with info styling", () => {
    renderWithProviders(<LoadingAlert />);

    const alert = document.querySelector(".alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("alert-info");
  });

  it("renders a loading spinner", () => {
    renderWithProviders(<LoadingAlert />);

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it('displays "Fetching latest prices from poe.ninja..." message', () => {
    renderWithProviders(<LoadingAlert />);

    expect(
      screen.getByText("Fetching latest prices from poe.ninja..."),
    ).toBeInTheDocument();
  });
});
