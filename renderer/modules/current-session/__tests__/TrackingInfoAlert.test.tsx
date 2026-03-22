import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import TrackingInfoAlert from "../CurrentSession.components/TrackingInfoAlert/TrackingInfoAlert";

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

  it('includes a tooltip with "Right click" data-tip attribute', () => {
    renderWithProviders(<TrackingInfoAlert />);

    const rightClickTooltip = document.querySelector(
      '[data-tip="Right click"]',
    );
    expect(rightClickTooltip).toBeInTheDocument();
    expect(rightClickTooltip).toHaveClass("tooltip");
  });

  it('includes a tooltip with "Left click" data-tip attribute', () => {
    renderWithProviders(<TrackingInfoAlert />);

    const leftClickTooltip = document.querySelector('[data-tip="Left click"]');
    expect(leftClickTooltip).toBeInTheDocument();
    expect(leftClickTooltip).toHaveClass("tooltip");
  });
});
