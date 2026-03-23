import React from "react";

import {
  act,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";

import type { ModalHandle } from "./Modal";
import Modal from "./Modal";

// jsdom does not implement HTMLDialogElement.showModal() or .close(),
// so we must mock them before each test.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Modal", () => {
  // ── 1. Renders children ────────────────────────────────────────────────

  it("renders children inside the dialog", () => {
    renderWithProviders(
      <Modal>
        <p>Modal content</p>
      </Modal>,
    );

    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  // ── 2. Imperative open / close ─────────────────────────────────────────

  it("calls showModal() on the dialog when ref.open() is invoked", () => {
    const ref = React.createRef<ModalHandle>();

    renderWithProviders(
      <Modal ref={ref}>
        <p>Open me</p>
      </Modal>,
    );

    act(() => {
      ref.current!.open();
    });

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  });

  it("calls close() on the dialog when ref.close() is invoked", () => {
    const ref = React.createRef<ModalHandle>();

    renderWithProviders(
      <Modal ref={ref}>
        <p>Close me</p>
      </Modal>,
    );

    act(() => {
      ref.current!.close();
    });

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
  });

  // ── 3. Size variants ──────────────────────────────────────────────────

  it("applies max-w-sm when size is sm", () => {
    renderWithProviders(
      <Modal size="sm">
        <p>Small</p>
      </Modal>,
    );

    const modalBox = screen.getByText("Small").closest(".modal-box");
    expect(modalBox).toHaveClass("max-w-sm");
    expect(modalBox).not.toHaveClass("max-w-lg");
    expect(modalBox).not.toHaveClass("max-w-3xl");
  });

  it("applies max-w-lg when size is md", () => {
    renderWithProviders(
      <Modal size="md">
        <p>Medium</p>
      </Modal>,
    );

    const modalBox = screen.getByText("Medium").closest(".modal-box");
    expect(modalBox).toHaveClass("max-w-lg");
  });

  it("applies max-w-3xl when size is lg", () => {
    renderWithProviders(
      <Modal size="lg">
        <p>Large</p>
      </Modal>,
    );

    const modalBox = screen.getByText("Large").closest(".modal-box");
    expect(modalBox).toHaveClass("max-w-3xl");
  });

  it("defaults to md (max-w-lg) when no size prop is provided", () => {
    renderWithProviders(
      <Modal>
        <p>Default</p>
      </Modal>,
    );

    const modalBox = screen.getByText("Default").closest(".modal-box");
    expect(modalBox).toHaveClass("max-w-lg");
  });

  // ── 4. Custom className ───────────────────────────────────────────────

  it("merges custom className with base modal-box classes", () => {
    renderWithProviders(
      <Modal className="my-custom-class">
        <p>Custom</p>
      </Modal>,
    );

    const modalBox = screen.getByText("Custom").closest(".modal-box");
    expect(modalBox).toHaveClass("modal-box");
    expect(modalBox).toHaveClass("border");
    expect(modalBox).toHaveClass("border-base-300");
    expect(modalBox).toHaveClass("bg-base-300");
    expect(modalBox).toHaveClass("my-custom-class");
  });

  // ── 5. Backdrop close enabled (default) ───────────────────────────────

  it("renders the backdrop form with a submit button by default", () => {
    const { container } = renderWithProviders(
      <Modal>
        <p>Backdrop enabled</p>
      </Modal>,
    );

    const form = container.querySelector('form[method="dialog"]');
    expect(form).toBeInTheDocument();
    expect(form).toHaveClass("modal-backdrop");

    const submitButton = form!.querySelector('button[type="submit"]');
    expect(submitButton).toBeInTheDocument();
  });

  it("renders the backdrop form when closeOnBackdrop is explicitly true", () => {
    const { container } = renderWithProviders(
      <Modal closeOnBackdrop={true}>
        <p>Backdrop explicit</p>
      </Modal>,
    );

    const form = container.querySelector('form[method="dialog"]');
    expect(form).toBeInTheDocument();
  });

  // ── 6. Backdrop close disabled ────────────────────────────────────────

  it("does NOT render the backdrop form when closeOnBackdrop is false", () => {
    const { container } = renderWithProviders(
      <Modal closeOnBackdrop={false}>
        <p>No backdrop</p>
      </Modal>,
    );

    const form = container.querySelector('form[method="dialog"]');
    expect(form).not.toBeInTheDocument();
  });

  // ── 7. onClose callback ───────────────────────────────────────────────

  it("fires the onClose callback when the dialog close event triggers", () => {
    const onClose = vi.fn();

    const { container } = renderWithProviders(
      <Modal onClose={onClose}>
        <p>Closable</p>
      </Modal>,
    );

    const dialog = container.querySelector("dialog")!;

    act(() => {
      dialog.dispatchEvent(new Event("close", { bubbles: false }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── 8. onClose not provided ───────────────────────────────────────────

  it("does not crash when the close event fires and onClose is not provided", () => {
    const { container } = renderWithProviders(
      <Modal>
        <p>No onClose</p>
      </Modal>,
    );

    const dialog = container.querySelector("dialog")!;

    expect(() => {
      act(() => {
        dialog.dispatchEvent(new Event("close", { bubbles: false }));
      });
    }).not.toThrow();
  });

  // ── 9. Dialog base classes ────────────────────────────────────────────

  it("applies the correct base classes to the dialog element", () => {
    const { container } = renderWithProviders(
      <Modal>
        <p>Base classes</p>
      </Modal>,
    );

    const dialog = container.querySelector("dialog")!;
    expect(dialog).toHaveClass("modal");
    expect(dialog).toHaveClass("modal-bottom");
    expect(dialog).toHaveClass("sm:modal-middle");
    expect(dialog).toHaveClass("backdrop-blur-xs");
  });

  // ── 10. Modal-box base classes ────────────────────────────────────────

  it("applies the correct base classes to the modal-box div", () => {
    renderWithProviders(
      <Modal>
        <p>Box classes</p>
      </Modal>,
    );

    const modalBox = screen.getByText("Box classes").closest("div");
    expect(modalBox).toHaveClass("modal-box");
    expect(modalBox).toHaveClass("border");
    expect(modalBox).toHaveClass("border-base-300");
    expect(modalBox).toHaveClass("bg-base-300");
  });
});
