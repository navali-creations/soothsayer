import {
  fireEvent,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";

import Dropdown from "./Dropdown";

describe("Dropdown", () => {
  it("renders trigger content", () => {
    renderWithProviders(
      <Dropdown trigger={<span>Open Menu</span>}>
        <li>Item</li>
      </Dropdown>,
    );

    expect(screen.getByText("Open Menu")).toBeInTheDocument();
  });

  it("labels an icon-only trigger", () => {
    renderWithProviders(
      <Dropdown
        ariaLabel="More options"
        trigger={<span aria-hidden>Icon</span>}
      >
        <li>Item</li>
      </Dropdown>,
    );

    expect(
      screen.getByRole("button", { name: "More options" }),
    ).toBeInTheDocument();
  });

  it("renders children in dropdown panel", () => {
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>}>
        <li>Menu Item 1</li>
        <li>Menu Item 2</li>
      </Dropdown>,
    );

    expect(screen.getByText("Menu Item 1")).toBeInTheDocument();
    expect(screen.getByText("Menu Item 2")).toBeInTheDocument();
  });

  it("trigger button has popoverTarget matching panel id", () => {
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>}>
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    const popoverTargetId = button.getAttribute("popovertarget");
    expect(popoverTargetId).toBeTruthy();

    const panel = document.getElementById(popoverTargetId!);
    expect(panel).toBeInTheDocument();
  });

  it('panel has popover="auto" attribute', () => {
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>}>
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    const popoverTargetId = button.getAttribute("popovertarget")!;
    const panel = document.getElementById(popoverTargetId);

    expect(panel).toHaveAttribute("popover", "auto");
  });

  it('applies default position class "dropdown-end"', () => {
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>}>
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    const popoverTargetId = button.getAttribute("popovertarget")!;
    const panel = document.getElementById(popoverTargetId);

    expect(panel).toHaveClass("dropdown-end");
  });

  it("joins array of positions into class string", () => {
    renderWithProviders(
      <Dropdown
        trigger={<span>Trigger</span>}
        position={["dropdown-top", "dropdown-end"]}
      >
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    const popoverTargetId = button.getAttribute("popovertarget")!;
    const panel = document.getElementById(popoverTargetId);

    expect(panel).toHaveClass("dropdown-top");
    expect(panel).toHaveClass("dropdown-end");
  });

  it("applies custom className to trigger button", () => {
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>} className="my-custom-trigger">
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveClass("my-custom-trigger");
  });

  it("applies custom contentClassName to panel", () => {
    renderWithProviders(
      <Dropdown
        trigger={<span>Trigger</span>}
        contentClassName="my-custom-panel"
      >
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    const popoverTargetId = button.getAttribute("popovertarget")!;
    const panel = document.getElementById(popoverTargetId);

    expect(panel).toHaveClass("my-custom-panel");
  });

  it('applies default width "w-52" and padding "p-2"', () => {
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>}>
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    const popoverTargetId = button.getAttribute("popovertarget")!;
    const panel = document.getElementById(popoverTargetId);

    expect(panel).toHaveClass("w-52");
    expect(panel).toHaveClass("p-2");
  });

  it("applies custom width and padding overriding defaults", () => {
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>} width="w-64" padding="p-4">
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    const popoverTargetId = button.getAttribute("popovertarget")!;
    const panel = document.getElementById(popoverTargetId);

    expect(panel).toHaveClass("w-64");
    expect(panel).toHaveClass("p-4");
    expect(panel).not.toHaveClass("w-52");
    expect(panel).not.toHaveClass("p-2");
  });

  it('trigger button has "no-drag" class', () => {
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>}>
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveClass("no-drag");
  });

  it('dropdown panel has "no-drag" class', () => {
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>}>
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    const popoverTargetId = button.getAttribute("popovertarget")!;
    const panel = document.getElementById(popoverTargetId);

    expect(panel).toHaveClass("no-drag");
  });

  it("closes the popover after a content click when closeOnSelect is enabled", () => {
    const hidePopover = vi.spyOn(HTMLElement.prototype, "hidePopover");
    hidePopover.mockClear();
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>} closeOnSelect>
        <button type="button">Menu action</button>
      </Dropdown>,
    );

    fireEvent.click(screen.getByText("Menu action"));

    expect(hidePopover).toHaveBeenCalledTimes(1);
  });

  it("keeps the popover open after a content click by default", () => {
    const hidePopover = vi.spyOn(HTMLElement.prototype, "hidePopover");
    hidePopover.mockClear();
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>}>
        <button type="button">Menu action</button>
      </Dropdown>,
    );

    fireEvent.click(screen.getByText("Menu action"));

    expect(hidePopover).not.toHaveBeenCalled();
  });

  it("reports when the popover opens and closes", () => {
    const handleOpenChange = vi.fn();
    renderWithProviders(
      <Dropdown trigger={<span>Trigger</span>} onOpenChange={handleOpenChange}>
        <li>Content</li>
      </Dropdown>,
    );

    const button = screen.getByRole("button");
    const popoverTargetId = button.getAttribute("popovertarget")!;
    const panel = document.getElementById(popoverTargetId)!;
    const openEvent = new Event("toggle");
    const closeEvent = new Event("toggle");
    Object.defineProperty(openEvent, "newState", { value: "open" });
    Object.defineProperty(closeEvent, "newState", { value: "closed" });

    fireEvent(panel, openEvent);
    fireEvent(panel, closeEvent);

    expect(handleOpenChange).toHaveBeenNthCalledWith(1, true);
    expect(handleOpenChange).toHaveBeenNthCalledWith(2, false);
  });
});
