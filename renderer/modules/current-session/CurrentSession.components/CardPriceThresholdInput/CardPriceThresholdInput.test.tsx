import { fireEvent, waitFor, within } from "@testing-library/react";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import type { BoundStore } from "~/renderer/store/store.types";

import CardPriceThresholdInput from "./CardPriceThresholdInput";

let store: TestStore;
vi.mock("~/renderer/store", () => ({
  useBoundStore: (selector: (state: BoundStore) => unknown) => store(selector),
}));

beforeEach(() => {
  store = createTestStore();
});

describe("CardPriceThresholdInput", () => {
  it("is available with a label and chaos units while there is no active session", () => {
    renderWithProviders(<CardPriceThresholdInput />);
    const input = screen.getByRole("spinbutton", {
      name: "Threshold",
    });
    expect(input).toBeEnabled();
    expect(input.closest(".stat")).toBeInTheDocument();
    expect(input.closest(".stat-value")).toBeInTheDocument();
    expect(screen.getByText("chaos")).toBeInTheDocument();
    expect(screen.getByText("0 disables hiding")).toBeInTheDocument();
  });

  it("explains the threshold on title hover and keyboard focus without a duplicate icon", async () => {
    const { user } = renderWithProviders(<CardPriceThresholdInput />);
    const info = screen
      .getByText("Threshold")
      .closest<HTMLElement>(".app-tooltip-trigger")!;
    expect(info).toHaveClass("underline", "decoration-dotted");
    const tooltip = within(info).getByRole("tooltip", { hidden: true });
    const showPopover = vi.fn();
    tooltip.showPopover = showPopover;
    await user.hover(info);
    expect(showPopover).toHaveBeenCalledOnce();
    expect(tooltip).toHaveTextContent(
      "Excludes cards worth less than this chaos value from session totals and profit.",
    );
    expect(tooltip).toHaveTextContent(
      "Clear or set to 0 to disable automatic hiding.",
    );
    await user.unhover(info);
    await user.tab();
    expect(info).toHaveFocus();
    expect(showPopover).toHaveBeenCalledTimes(2);
    expect(tooltip).toHaveTextContent("Applies to existing and new drops.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("saves fractional values and clears the threshold to zero", async () => {
    const { user } = renderWithProviders(<CardPriceThresholdInput />);
    const input = screen.getByRole("spinbutton");
    await user.type(input, "2.75");
    expect(input).toHaveValue(2.75);
    await waitFor(() =>
      expect(
        window.electron.session.setCardPriceThreshold,
      ).toHaveBeenLastCalledWith("poe1", 2.75),
    );
    await user.clear(input);
    await waitFor(() =>
      expect(
        window.electron.session.setCardPriceThreshold,
      ).toHaveBeenLastCalledWith("poe1", 0),
    );
  });

  it("accepts three digits and rejects a fourth digit when typing or pasting", async () => {
    const { user } = renderWithProviders(<CardPriceThresholdInput />);
    const input = screen.getByRole("spinbutton");
    await user.type(input, "9999");
    expect(input).toHaveValue(999);
    await waitFor(() =>
      expect(
        window.electron.session.setCardPriceThreshold,
      ).toHaveBeenLastCalledWith("poe1", 999),
    );
    await user.clear(input);
    await waitFor(() =>
      expect(
        window.electron.session.setCardPriceThreshold,
      ).toHaveBeenLastCalledWith("poe1", 0),
    );
    const update = vi.mocked(window.electron.session.setCardPriceThreshold);
    update.mockClear();
    await user.paste("1000");
    expect(input).toHaveValue(null);
    expect(update).not.toHaveBeenCalled();
  });

  it("shows the threshold for the selected game", () => {
    store = createTestStore({
      settings: { selectedGame: "poe2" },
      currentSession: { cardPriceThresholds: { poe1: 2, poe2: 5 } },
    });
    renderWithProviders(<CardPriceThresholdInput />);
    expect(screen.getByRole("spinbutton")).toHaveValue(5);
  });

  it("rejects negative values", () => {
    renderWithProviders(<CardPriceThresholdInput />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "-1" },
    });
    expect(
      window.electron.session.setCardPriceThreshold,
    ).not.toHaveBeenCalled();
  });

  it("shows a save error", async () => {
    const electron = window.electron as unknown as ElectronMock;
    electron.session.setCardPriceThreshold.mockResolvedValue({
      success: false,
    });
    const { user } = renderWithProviders(<CardPriceThresholdInput />);
    await user.type(screen.getByRole("spinbutton"), "2");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to save the threshold",
    );
    expect(screen.getByRole("spinbutton")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
