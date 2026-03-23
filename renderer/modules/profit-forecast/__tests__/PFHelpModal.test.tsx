import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import PFHelpModal from "../ProfitForecast.components/PFHelpModal";

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PFHelpModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when isOpen is false", () => {
    const { container } = renderWithProviders(
      <PFHelpModal isOpen={false} onClose={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders modal content when isOpen is true", () => {
    renderWithProviders(<PFHelpModal isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByText("Profit Forecast — How It Works"),
    ).toBeInTheDocument();
  });

  it("renders P&L explanation sections when open", () => {
    renderWithProviders(<PFHelpModal isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByText("P&L (card only) vs P&L (all drops)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What changes with batch size?"),
    ).toBeInTheDocument();
    // "Break-Even Rate" appears both as a section heading and in the table
    const breakEvenMatches = screen.getAllByText("Break-Even Rate");
    expect(breakEvenMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Icons & Indicators")).toBeInTheDocument();
  });

  it("renders the 'Got it' close button when open", () => {
    renderWithProviders(<PFHelpModal isOpen={true} onClose={vi.fn()} />);

    // dialog elements make children inaccessible by default in jsdom
    expect(
      screen.getByRole("button", { name: "Got it", hidden: true }),
    ).toBeInTheDocument();
  });

  it("calls onClose when the 'Got it' button is clicked", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <PFHelpModal isOpen={true} onClose={onClose} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Got it", hidden: true }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the X button is clicked", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <PFHelpModal isOpen={true} onClose={onClose} />,
    );

    // The X button is a small circle ghost button inside the header;
    // it's the only btn-circle in the component
    const xButton = document.querySelector(".btn-circle") as HTMLElement;
    expect(xButton).toBeTruthy();

    await user.click(xButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <PFHelpModal isOpen={true} onClose={onClose} />,
    );

    // The <dialog> element itself has onClick={onClose}
    const dialog = document.querySelector("dialog") as HTMLElement;
    expect(dialog).toBeInTheDocument();

    await user.click(dialog);

    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when inner modal content is clicked", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <PFHelpModal isOpen={true} onClose={onClose} />,
    );

    // Click on the modal-box content area (stopPropagation prevents onClose)
    const modalBox = document.querySelector(".modal-box") as HTMLElement;
    expect(modalBox).toBeInTheDocument();

    await user.click(modalBox);

    // onClose should NOT have been called from the content click
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the backdrop form button is clicked", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <PFHelpModal isOpen={true} onClose={onClose} />,
    );

    // The modal-backdrop has a <button> with text "close"
    const backdropButton = screen.getByRole("button", {
      name: "close",
      hidden: true,
    });
    expect(backdropButton).toBeInTheDocument();

    await user.click(backdropButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("renders the table explaining batch-dependent columns", () => {
    renderWithProviders(<PFHelpModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("% Chance")).toBeInTheDocument();
    expect(screen.getByText("Column / Stat")).toBeInTheDocument();
    expect(screen.getByText("Changes with batch?")).toBeInTheDocument();
  });

  it("renders the disclaimer alert", () => {
    renderWithProviders(<PFHelpModal isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByText(/All figures are estimates based on poe\.ninja/),
    ).toBeInTheDocument();
  });
});
