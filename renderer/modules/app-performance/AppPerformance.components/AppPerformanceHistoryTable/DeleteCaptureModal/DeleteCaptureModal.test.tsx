import {
  fireEvent,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { DeleteCapturesModal } from "./DeleteCaptureModal";

describe("DeleteCapturesModal", () => {
  beforeEach(() => {
    useBoundStore.getState().reset();
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = false;
    });
  });

  it("opens and confirms deletion for selected captures", async () => {
    window.electron.appPerformance.deleteCaptures.mockResolvedValue({
      success: true,
      deletedCount: 2,
    });
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.isDeleteConfirmOpen = true;
      appPerformance.selectedCaptureIds = ["capture-1", "capture-2"];
    });

    const { user } = renderWithProviders(<DeleteCapturesModal />);

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(
      screen.getByText("Delete 2 selected diagnostics captures?"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Delete captures/i }));

    expect(window.electron.appPerformance.deleteCaptures).toHaveBeenCalledWith([
      "capture-1",
      "capture-2",
    ]);
    expect(window.electron.appPerformance.deleteCapture).not.toHaveBeenCalled();
  });

  it("closes through cancel and renders singular copy plus error state", async () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.isDeleteConfirmOpen = true;
      appPerformance.selectedCaptureIds = ["capture-1"];
      appPerformance.deleteError = "Delete failed";
    });

    const { user } = renderWithProviders(<DeleteCapturesModal />);

    expect(
      screen.getByText("Delete 1 selected diagnostics capture?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Delete failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
    expect(useBoundStore.getState().appPerformance.isDeleteConfirmOpen).toBe(
      false,
    );
  });

  it("disables the destructive action while deleting or when nothing is selected", () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.isBulkDeleting = true;
    });

    renderWithProviders(<DeleteCapturesModal />);

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Delete captures/i, hidden: true }),
    ).toBeDisabled();
  });

  it("notifies the parent when the native dialog close event fires", () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.isDeleteConfirmOpen = true;
      appPerformance.selectedCaptureIds = ["capture-1"];
    });
    renderWithProviders(<DeleteCapturesModal />);

    fireEvent(screen.getByRole("dialog", { hidden: true }), new Event("close"));

    expect(useBoundStore.getState().appPerformance.isDeleteConfirmOpen).toBe(
      false,
    );
  });

  it("prevents native cancel while a bulk delete is running", () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.isBulkDeleting = true;
      appPerformance.isDeleteConfirmOpen = true;
      appPerformance.selectedCaptureIds = ["capture-1"];
    });
    renderWithProviders(<DeleteCapturesModal />);

    const event = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog", { hidden: true }), event);

    expect(event.defaultPrevented).toBe(true);
    expect(useBoundStore.getState().appPerformance.isDeleteConfirmOpen).toBe(
      true,
    );
  });
});
