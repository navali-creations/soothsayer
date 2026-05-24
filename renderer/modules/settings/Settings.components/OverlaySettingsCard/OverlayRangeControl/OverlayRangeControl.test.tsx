import { describe, expect, it, vi } from "vitest";

import {
  fireEvent,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";

import { OverlayRangeControl } from "./OverlayRangeControl";

describe("OverlayRangeControl", () => {
  it("renders its label, icon, range value, and display value", () => {
    renderWithProviders(
      <OverlayRangeControl
        icon={<span data-testid="range-icon" />}
        label="Width"
        value={320}
        displayValue="320px"
        min={200}
        max={600}
        step={10}
        onChange={vi.fn()}
      />,
    );

    const slider = screen.getByRole("slider");

    expect(screen.getByTestId("range-icon")).toBeInTheDocument();
    expect(screen.getByText("Width")).toBeInTheDocument();
    expect(screen.getByText("320px")).toBeInTheDocument();
    expect(slider).toHaveAttribute("min", "200");
    expect(slider).toHaveAttribute("max", "600");
    expect(slider).toHaveAttribute("step", "10");
    expect(slider).toHaveValue("320");
  });

  it("renders optional helper text when provided", () => {
    renderWithProviders(
      <OverlayRangeControl
        icon={<span />}
        label="Drop size"
        value={1}
        displayValue="100%"
        min={0.5}
        max={2}
        step={0.1}
        onChange={vi.fn()}
        description="Scales the drop row text and height"
      />,
    );

    expect(
      screen.getByText("Scales the drop row text and height"),
    ).toBeInTheDocument();
  });

  it("does not render helper text when no description is provided", () => {
    renderWithProviders(
      <OverlayRangeControl
        icon={<span />}
        label="Toolbar"
        value={1}
        displayValue="100%"
        min={0.5}
        max={2}
        step={0.1}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("Scales the drop row text and height"),
    ).not.toBeInTheDocument();
  });

  it("calls onChange when the slider changes", () => {
    const handleChange = vi.fn();

    renderWithProviders(
      <OverlayRangeControl
        icon={<span />}
        label="Height"
        value={175}
        displayValue="175px"
        min={130}
        max={500}
        step={5}
        onChange={handleChange}
      />,
    );

    fireEvent.change(screen.getByRole("slider"), {
      target: { value: "220" },
    });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
