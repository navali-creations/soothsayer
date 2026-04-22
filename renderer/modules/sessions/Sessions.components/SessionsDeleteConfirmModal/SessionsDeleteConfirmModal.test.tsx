import type { ComponentProps } from "react";

import {
  act,
  renderWithProviders,
  within,
} from "~/renderer/__test-setup__/render";

import { SessionsDeleteConfirmModal } from "./SessionsDeleteConfirmModal";

vi.mock("react-icons/fi", () => ({
  FiAlertTriangle: () => <span data-testid="icon-alert" />,
  FiTrash2: () => <span data-testid="icon-trash" />,
  FiX: () => <span data-testid="icon-x" />,
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderModal(
  overrides: Partial<ComponentProps<typeof SessionsDeleteConfirmModal>> = {},
) {
  const props = {
    error: null,
    isDeleting: false,
    isOpen: true,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    selectedCount: 2,
    ...overrides,
  };

  const result = renderWithProviders(<SessionsDeleteConfirmModal {...props} />);
  const dialog = result.container.querySelector("dialog") as HTMLDialogElement;

  return {
    ...result,
    dialog,
    props,
    scope: within(dialog),
  };
}

describe("SessionsDeleteConfirmModal", () => {
  it("opens the dialog when isOpen is true", () => {
    renderModal({ isOpen: true });

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled();
  });

  it("closes the dialog when isOpen is false", () => {
    renderModal({ isOpen: false });

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });

  it("syncs dialog state when isOpen changes", () => {
    const { rerender, props } = renderModal({ isOpen: false });

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);

    rerender(<SessionsDeleteConfirmModal {...props} isOpen={true} />);

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  });

  it("renders destructive confirmation copy for multiple sessions", () => {
    const { scope } = renderModal({ selectedCount: 3 });

    expect(
      scope.getByRole("heading", { name: "Delete sessions", hidden: true }),
    ).toBeInTheDocument();
    expect(scope.getByText("Delete 3 selected sessions?")).toBeInTheDocument();
    expect(
      scope.getByText("This action cannot be undone."),
    ).toBeInTheDocument();
    expect(
      scope.getByText(
        /Aggregate card statistics and total stacked decks opened/,
      ),
    ).toBeInTheDocument();
  });

  it("renders singular selected-session copy", () => {
    const { scope } = renderModal({ selectedCount: 1 });

    expect(scope.getByText("Delete 1 selected session?")).toBeInTheDocument();
  });

  it("renders the inline error when provided", () => {
    const { scope } = renderModal({
      error: "Active sessions cannot be deleted.",
    });

    const alert = scope.getByText("Active sessions cannot be deleted.");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("alert-error");
  });

  it("does not render an alert when there is no error", () => {
    const { scope } = renderModal({ error: null });

    expect(scope.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      scope.queryByText("Active sessions cannot be deleted."),
    ).not.toBeInTheDocument();
  });

  it("calls onCancel and closes when Cancel is clicked", async () => {
    const { props, scope, user } = renderModal();

    await user.click(
      scope.getByRole("button", { name: /cancel/i, hidden: true }),
    );

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel and closes when the backdrop button is clicked", async () => {
    const { props, scope, user } = renderModal();

    await user.click(
      scope.getByRole("button", { name: /close/i, hidden: true }),
    );

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the native dialog close event fires", () => {
    const { dialog, props } = renderModal();

    act(() => {
      dialog.dispatchEvent(new Event("close", { bubbles: false }));
    });

    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Delete sessions is clicked", async () => {
    const { props, scope, user } = renderModal();

    await user.click(
      scope.getByRole("button", {
        name: /^delete sessions$/i,
        hidden: true,
      }),
    );

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables actions while deletion is in progress", () => {
    const { scope } = renderModal({ isDeleting: true });

    expect(
      scope.getByRole("button", { name: /cancel/i, hidden: true }),
    ).toBeDisabled();
    expect(
      scope.getByRole("button", {
        name: /^delete sessions$/i,
        hidden: true,
      }),
    ).toBeDisabled();
  });

  it("disables confirm when no sessions are selected", () => {
    const { scope } = renderModal({ selectedCount: 0 });

    expect(
      scope.getByRole("button", {
        name: /^delete sessions$/i,
        hidden: true,
      }),
    ).toBeDisabled();
  });

  it("applies expected dialog and modal box classes", () => {
    const { dialog, scope } = renderModal();

    expect(dialog).toHaveClass("modal");
    expect(dialog).toHaveClass("modal-bottom");
    expect(dialog).toHaveClass("sm:modal-middle");
    expect(
      scope
        .getByRole("heading", { name: "Delete sessions", hidden: true })
        .closest(".modal-box"),
    ).toHaveClass("border-error");
  });
});
