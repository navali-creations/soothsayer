import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import Tooltip from "./Tooltip";

describe("Tooltip", () => {
  it("renders DaisyUI-compatible styling and anchor placement", () => {
    render(<Tooltip content="Helpful text">Trigger</Tooltip>);

    const trigger = screen.getByText("Trigger");
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    const caret = tooltip.querySelector<HTMLElement>(".app-tooltip-caret");

    expect(trigger).toHaveClass("app-tooltip-trigger", "no-drag");
    expect(trigger).toHaveAttribute("data-tip", "Helpful text");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    expect(trigger.style.anchorName).toBeTruthy();
    expect(tooltip.style.positionAnchor).toBe(trigger.style.anchorName);
    expect(tooltip).toHaveAttribute("popover", "manual");
    expect(tooltip).toHaveAttribute("aria-label", "Helpful text");
    expect(tooltip).toHaveClass("app-tooltip", "app-tooltip-bottom");
    expect(caret).toHaveAttribute("aria-hidden", "true");
    expect(caret?.style.positionAnchor).toBe(trigger.style.anchorName);
  });

  it("allows an alternate placement when explicitly requested", () => {
    render(
      <Tooltip content="Helpful text" placement="right">
        Trigger
      </Tooltip>,
    );

    expect(screen.getByRole("tooltip", { hidden: true })).toHaveClass(
      "app-tooltip-right",
    );
  });

  it("opens and closes on hover", () => {
    render(<Tooltip content="Helpful text">Trigger</Tooltip>);

    const trigger = screen.getByText("Trigger");
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    tooltip.showPopover = showPopover;
    tooltip.hidePopover = hidePopover;

    fireEvent.mouseEnter(trigger);
    expect(showPopover).toHaveBeenCalledOnce();

    fireEvent.mouseLeave(trigger);
    expect(hidePopover).toHaveBeenCalledOnce();
  });

  it("stays open while either hovered or focused", () => {
    render(
      <Tooltip content="Helpful text">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByText("Trigger").parentElement!;
    const button = screen.getByRole("button", { name: "Trigger" });
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    tooltip.showPopover = showPopover;
    tooltip.hidePopover = hidePopover;

    fireEvent.mouseEnter(trigger);
    fireEvent.focus(button);
    fireEvent.mouseLeave(trigger);
    expect(hidePopover).not.toHaveBeenCalled();

    fireEvent.blur(button);
    expect(hidePopover).toHaveBeenCalledOnce();
  });

  it("opens a forced-open tooltip under manual popover control", () => {
    const showPopover = vi.spyOn(HTMLElement.prototype, "showPopover");

    render(
      <Tooltip content="Always visible" open>
        Trigger
      </Tooltip>,
    );

    expect(screen.getByRole("tooltip", { hidden: true })).toHaveAttribute(
      "popover",
      "manual",
    );
    expect(showPopover).toHaveBeenCalled();
  });

  it("keeps an interactive trigger under manual popover control", () => {
    render(
      <Tooltip as="button" content="Helpful text" type="button">
        Trigger
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    tooltip.showPopover = showPopover;
    tooltip.hidePopover = hidePopover;

    fireEvent.mouseEnter(trigger);
    fireEvent.click(trigger);

    expect(tooltip).toHaveAttribute("popover", "manual");
    expect(showPopover).toHaveBeenCalledOnce();
    expect(hidePopover).not.toHaveBeenCalled();
  });

  it("does not expose or open a disabled tooltip", () => {
    render(
      <Tooltip content="Unavailable" disableTooltip>
        Trigger
      </Tooltip>,
    );

    const trigger = screen.getByText("Trigger");
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    const showPopover = vi.fn();
    tooltip.showPopover = showPopover;

    fireEvent.mouseEnter(trigger);

    expect(trigger).not.toHaveAttribute("aria-describedby");
    expect(trigger).not.toHaveAttribute("data-tip");
    expect(showPopover).not.toHaveBeenCalled();
  });

  it("describes an interactive child instead of its wrapper", () => {
    render(
      <Tooltip
        as="div"
        content="Helpful text"
        data-testid="trigger"
        describeChild
      >
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const wrapper = screen.getByTestId("trigger");
    const button = screen.getByRole("button", { name: "Trigger" });
    const tooltip = screen.getByRole("tooltip", { hidden: true });

    expect(wrapper).not.toHaveAttribute("aria-describedby");
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("forwards trigger handlers and attributes", () => {
    const handleMouseEnter = vi.fn();
    const handleFocus = vi.fn();

    render(
      <Tooltip
        as="div"
        className="custom-trigger"
        content="Helpful text"
        data-testid="trigger"
        onFocus={handleFocus}
        onMouseEnter={handleMouseEnter}
      >
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByTestId("trigger");
    fireEvent.mouseEnter(trigger);
    fireEvent.focus(screen.getByRole("button", { name: "Trigger" }));

    expect(trigger).toHaveClass(
      "app-tooltip-trigger",
      "no-drag",
      "custom-trigger",
    );
    expect(handleMouseEnter).toHaveBeenCalledOnce();
    expect(handleFocus).toHaveBeenCalledOnce();
  });
});
