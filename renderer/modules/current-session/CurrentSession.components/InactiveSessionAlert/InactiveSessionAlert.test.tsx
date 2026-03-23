import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import InactiveSessionAlert from "./InactiveSessionAlert";

describe("InactiveSessionAlert", () => {
  it("renders an alert with info styling", () => {
    renderWithProviders(<InactiveSessionAlert />);

    const alert = document.querySelector(".alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("alert-info");
  });

  it("shows message about starting a session", () => {
    renderWithProviders(<InactiveSessionAlert />);

    expect(
      screen.getByText(
        /No active session\. Select a league and click "Start Session" to begin tracking\./,
      ),
    ).toBeInTheDocument();
  });
});
