import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import TrackingInfoAlert from "./TrackingInfoAlert";

describe("TrackingInfoAlert", () => {
  it("renders a warning alert", () => {
    renderWithProviders(<TrackingInfoAlert />);

    const alert = document.querySelector(".alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("alert-warning");
  });

  it("shows info about how to open stacked decks in inventory", () => {
    renderWithProviders(<TrackingInfoAlert />);

    const alert = document.querySelector(".alert")!;
    expect(alert.textContent).toMatch(
      /only cards opened in your inventory are tracked/i,
    );
    expect(alert.textContent).toMatch(/on the stacked deck or hold/i);
    expect(alert.textContent).toMatch(/to open/i);
  });

  it("contains Ctrl keyboard shortcut indicator", () => {
    renderWithProviders(<TrackingInfoAlert />);

    const kbd = screen.getByText("Ctrl");
    expect(kbd).toBeInTheDocument();
    expect(kbd.tagName).toBe("KBD");
    expect(kbd).toHaveClass("kbd");
  });

  it('includes a tooltip with "Right mouse button" data-tip attribute', () => {
    renderWithProviders(<TrackingInfoAlert />);

    const rightClickTooltip = document.querySelector(
      '[data-tip="Right mouse button"]',
    );
    expect(rightClickTooltip).toBeInTheDocument();
    expect(rightClickTooltip).toHaveClass("app-tooltip-trigger");
  });

  it('includes a tooltip with "Left mouse button" data-tip attribute', () => {
    renderWithProviders(<TrackingInfoAlert />);

    const leftClickTooltip = document.querySelector(
      '[data-tip="Left mouse button"]',
    );
    expect(leftClickTooltip).toBeInTheDocument();
    expect(leftClickTooltip).toHaveClass("app-tooltip-trigger");
  });
});
