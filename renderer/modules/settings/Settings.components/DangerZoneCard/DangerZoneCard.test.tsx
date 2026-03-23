import { describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "~/renderer/__test-setup__/render";

import DangerZoneCard from "./DangerZoneCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

// jsdom does not implement HTMLDialogElement.showModal() or .close(),
// so we must mock them before each test.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiAlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  FiTrash2: () => <span data-testid="icon-trash" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the "Reset Database" button that lives in the main card body
 * (not the one inside the confirmation modal).
 */
function getCardResetButton(): HTMLButtonElement {
  const card = document.querySelector(".card")!;
  const cardScope = within(card as HTMLElement);
  // The card has exactly one button containing "Reset Database"
  const buttons = cardScope.getAllByRole("button");
  const resetBtn = buttons.find((btn) =>
    btn.textContent?.includes("Reset Database"),
  );
  if (!resetBtn) throw new Error("Reset Database button not found in card");
  return resetBtn as HTMLButtonElement;
}

/**
 * Returns the "Delete Everything & Restart" confirm button inside the modal.
 * Uses hidden: true because the <dialog> is not open in jsdom.
 */
function getConfirmButton(): HTMLButtonElement {
  const dialog = document.querySelector("dialog")!;
  const dialogScope = within(dialog as HTMLElement);
  const buttons = dialogScope.getAllByRole("button", { hidden: true });
  const confirmBtn = buttons.find((btn) =>
    btn.textContent?.includes("Delete Everything & Restart"),
  );
  if (!confirmBtn)
    throw new Error("Delete Everything & Restart button not found in dialog");
  return confirmBtn as HTMLButtonElement;
}

/**
 * Returns the "Cancel" button inside the modal.
 * Uses hidden: true because the <dialog> is not open in jsdom.
 */
function getCancelButton(): HTMLButtonElement {
  const dialog = document.querySelector("dialog")!;
  const dialogScope = within(dialog as HTMLElement);
  const buttons = dialogScope.getAllByRole("button", { hidden: true });
  const cancelBtn = buttons.find((btn) => btn.textContent?.trim() === "Cancel");
  if (!cancelBtn) throw new Error("Cancel button not found in dialog");
  return cancelBtn as HTMLButtonElement;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("DangerZoneCard", () => {
  // ── Rendering ──────────────────────────────────────────────────────────

  it('renders "Danger Zone" heading', () => {
    renderWithProviders(<DangerZoneCard />);

    expect(
      screen.getByRole("heading", { name: /Danger Zone/i }),
    ).toBeInTheDocument();
  });

  it('renders "Reset Database" button in the card', () => {
    renderWithProviders(<DangerZoneCard />);

    const resetButton = getCardResetButton();
    expect(resetButton).toBeInTheDocument();
  });

  it("renders description text about irreversible actions", () => {
    renderWithProviders(<DangerZoneCard />);

    expect(
      screen.getByText("Irreversible actions that affect your data"),
    ).toBeInTheDocument();
  });

  it("renders the database reset description in the card body", () => {
    renderWithProviders(<DangerZoneCard />);

    const card = document.querySelector(".card")!;
    const cardScope = within(card as HTMLElement);
    expect(
      cardScope.getByText(
        /Permanently delete all sessions, statistics, and price snapshots/,
      ),
    ).toBeInTheDocument();
  });

  // ── Modal open ─────────────────────────────────────────────────────────

  it("opens the confirmation modal when Reset Database button is clicked", async () => {
    const { user } = renderWithProviders(<DangerZoneCard />);

    const resetButton = getCardResetButton();
    await user.click(resetButton);

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  });

  it("renders the confirmation modal with warning list items", () => {
    renderWithProviders(<DangerZoneCard />);

    const dialog = document.querySelector("dialog")!;
    const dialogScope = within(dialog as HTMLElement);

    expect(
      dialogScope.getByText("All sessions and session history"),
    ).toBeInTheDocument();
    expect(dialogScope.getByText("All card statistics")).toBeInTheDocument();
    expect(dialogScope.getByText("All price snapshots")).toBeInTheDocument();
    expect(
      dialogScope.getByText(
        /This action cannot be undone\. The application will restart\./,
      ),
    ).toBeInTheDocument();
  });

  it('renders "Cancel" and "Delete Everything & Restart" buttons in the modal', () => {
    renderWithProviders(<DangerZoneCard />);

    expect(getCancelButton()).toBeInTheDocument();
    expect(getConfirmButton()).toBeInTheDocument();
  });

  // ── Modal close via Cancel ─────────────────────────────────────────────

  it("closes the modal when Cancel button is clicked", async () => {
    const { user } = renderWithProviders(<DangerZoneCard />);

    // Open modal first
    await user.click(getCardResetButton());

    // Click Cancel
    await user.click(getCancelButton());

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  // ── Confirm reset: success ─────────────────────────────────────────────

  it("calls window.electron.settings.resetDatabase on confirm", async () => {
    window.electron.settings.resetDatabase = vi
      .fn()
      .mockResolvedValue({ success: true });

    const { user } = renderWithProviders(<DangerZoneCard />);

    // Open modal
    await user.click(getCardResetButton());

    // Confirm
    await user.click(getConfirmButton());

    await waitFor(() => {
      expect(window.electron.settings.resetDatabase).toHaveBeenCalledTimes(1);
    });
  });

  it("calls window.electron.app.restart on successful reset", async () => {
    window.electron.settings.resetDatabase = vi
      .fn()
      .mockResolvedValue({ success: true });
    window.electron.app.restart = vi.fn();

    const { user } = renderWithProviders(<DangerZoneCard />);

    // Open modal
    await user.click(getCardResetButton());

    // Confirm
    await user.click(getConfirmButton());

    await waitFor(() => {
      expect(window.electron.app.restart).toHaveBeenCalledTimes(1);
    });
  });

  // ── Confirm reset: failure (result.error) ──────────────────────────────

  it("shows error message in modal when resetDatabase returns an error", async () => {
    window.electron.settings.resetDatabase = vi
      .fn()
      .mockResolvedValue({ success: false, error: "Database is locked" });

    const { user } = renderWithProviders(<DangerZoneCard />);

    // Open modal
    await user.click(getCardResetButton());

    // Confirm
    await user.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByRole("alert", { hidden: true })).toHaveTextContent(
        "Database is locked",
      );
    });
  });

  it("shows 'Unknown error' when resetDatabase returns success false without error message", async () => {
    window.electron.settings.resetDatabase = vi
      .fn()
      .mockResolvedValue({ success: false });

    const { user } = renderWithProviders(<DangerZoneCard />);

    // Open modal
    await user.click(getCardResetButton());

    // Confirm
    await user.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByRole("alert", { hidden: true })).toHaveTextContent(
        "Unknown error",
      );
    });
  });

  it("does not call app.restart when resetDatabase fails", async () => {
    window.electron.settings.resetDatabase = vi
      .fn()
      .mockResolvedValue({ success: false, error: "Failed" });
    window.electron.app.restart = vi.fn();

    const { user } = renderWithProviders(<DangerZoneCard />);

    // Open modal
    await user.click(getCardResetButton());

    // Confirm
    await user.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByRole("alert", { hidden: true })).toBeInTheDocument();
    });

    expect(window.electron.app.restart).not.toHaveBeenCalled();
  });

  // ── Confirm reset: exception ───────────────────────────────────────────

  it("shows error message when resetDatabase throws an exception", async () => {
    window.electron.settings.resetDatabase = vi
      .fn()
      .mockRejectedValue(new Error("IPC connection lost"));

    const { user } = renderWithProviders(<DangerZoneCard />);

    // Open modal
    await user.click(getCardResetButton());

    // Confirm
    await user.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByRole("alert", { hidden: true })).toHaveTextContent(
        "IPC connection lost",
      );
    });
  });

  // ── Error cleared on re-open ───────────────────────────────────────────

  it("clears error when the modal is reopened", async () => {
    window.electron.settings.resetDatabase = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: "First failure" })
      .mockResolvedValueOnce({ success: true });

    const { user } = renderWithProviders(<DangerZoneCard />);

    // Open modal and trigger error
    await user.click(getCardResetButton());
    await user.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByRole("alert", { hidden: true })).toHaveTextContent(
        "First failure",
      );
    });

    // Re-open the modal — error should be cleared
    await user.click(getCardResetButton());

    expect(
      screen.queryByRole("alert", { hidden: true }),
    ).not.toBeInTheDocument();
  });
});
