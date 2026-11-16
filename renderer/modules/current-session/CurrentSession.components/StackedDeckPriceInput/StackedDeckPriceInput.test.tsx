import { act, fireEvent, waitFor, within } from "@testing-library/react";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import { makeDetailedSession } from "~/renderer/__test-setup__/fixtures";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import type { BoundStore } from "~/renderer/store/store.types";

import StackedDeckPriceInput from "./StackedDeckPriceInput";

let store: TestStore;
vi.mock("~/renderer/store", () => ({
  useBoundStore: (selector: (state: BoundStore) => unknown) => store(selector),
}));
beforeEach(() => {
  store = createTestStore();
});

describe("StackedDeckPriceInput", () => {
  it("indicates automatic pricing when no override is set", () => {
    renderWithProviders(<StackedDeckPriceInput />);
    expect(
      screen.getByRole("textbox", { name: "Override Deck Price" }),
    ).toBeEnabled();
    expect(screen.getByText("Using poe.ninja price")).toBeInTheDocument();
    expect(screen.getByText("chaos / deck")).toBeInTheDocument();
  });

  it("opens the explanation from the label on hover and keyboard focus", async () => {
    const { user } = renderWithProviders(<StackedDeckPriceInput />);
    const label = screen
      .getByText("Override Deck Price")
      .closest<HTMLElement>(".app-tooltip-trigger")!;
    const tooltip = within(label).getByRole("tooltip", { hidden: true });
    const showPopover = vi.fn();
    tooltip.showPopover = showPopover;
    await user.hover(label);
    expect(showPopover).toHaveBeenCalledOnce();
    expect(tooltip).toHaveTextContent(
      "Override the chaos price paid per Stacked Deck",
    );
    await user.unhover(label);
    await user.tab();
    expect(label).toHaveFocus();
    expect(showPopover).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("saves fractional prices, accepts zero, and clears back to automatic pricing", async () => {
    const { user } = renderWithProviders(<StackedDeckPriceInput />);
    const input = screen.getByRole("textbox");
    await user.type(input, "2.25");
    await waitFor(() =>
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe1", 2.25),
    );
    expect(screen.getByText("Custom price per deck")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "0");
    await waitFor(() =>
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe1", 0),
    );
    expect(input).toHaveValue("0");
    await user.clear(input);
    await waitFor(() =>
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe1", null),
    );
    expect(screen.getByText("Using poe.ninja price")).toBeInTheDocument();
  });

  it("accepts a comma while typing and saves a numeric decimal price", async () => {
    const { user } = renderWithProviders(<StackedDeckPriceInput />);
    const input = screen.getByRole("textbox", { name: "Override Deck Price" });
    await user.type(input, "2,25");
    expect(input).toHaveValue("2,25");
    await waitFor(() =>
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe1", 2.25),
    );
    await user.clear(input);
    await waitFor(() =>
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe1", null),
    );
  });

  it("accepts a pasted comma-separated price", async () => {
    const { user } = renderWithProviders(<StackedDeckPriceInput />);
    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.paste("12,50");
    expect(input).toHaveValue("12,50");
    await waitFor(() =>
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe1", 12.5),
    );
  });

  it.each(["1,2,3", "1.2.3", "1,2.3", "999,01", "1e3"])(
    "rejects malformed or excessive price %s",
    (value) => {
      renderWithProviders(<StackedDeckPriceInput />);
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveValue("");
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).not.toHaveBeenCalled();
    },
  );

  it("allows a leading decimal separator and resets an unfinished separator on blur", async () => {
    const { user } = renderWithProviders(<StackedDeckPriceInput />);
    const input = screen.getByRole("textbox");
    await user.type(input, ",");
    expect(input).toHaveValue(",");
    expect(
      window.electron.session.setStackedDeckPriceOverride,
    ).not.toHaveBeenCalled();
    await user.tab();
    expect(input).toHaveValue("");
    await user.type(input, ",5");
    await waitFor(() =>
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe1", 0.5),
    );
  });

  it("shows the selected game's saved price when switching games during an edit", async () => {
    store = createTestStore({
      currentSession: { stackedDeckPriceOverrides: { poe1: null, poe2: 4.5 } },
    });
    const { user } = renderWithProviders(<StackedDeckPriceInput />);
    const input = screen.getByRole("textbox");
    await user.type(input, "2,25");
    act(() => store.getState().settings.setSetting("selectedGame", "poe2"));
    expect(input).toHaveValue("4.5");
  });

  it("shows the snapshot price as the automatic placeholder", () => {
    store = createTestStore({
      currentSession: {
        poe1Session: makeDetailedSession({
          priceSnapshot: {
            timestamp: "2026-11-16",
            stackedDeckChaosCost: 3,
            chaosToDivineRatio: 100,
            cardPrices: {},
          },
        }),
      },
    });
    renderWithProviders(<StackedDeckPriceInput />);
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "3.00");
  });

  it("accepts three digits and rejects a fourth digit when typing or pasting", async () => {
    const { user } = renderWithProviders(<StackedDeckPriceInput />);
    const input = screen.getByRole("textbox");
    await user.type(input, "9999");
    expect(input).toHaveValue("999");
    await waitFor(() =>
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe1", 999),
    );
    await user.clear(input);
    await waitFor(() =>
      expect(
        window.electron.session.setStackedDeckPriceOverride,
      ).toHaveBeenLastCalledWith("poe1", null),
    );
    const update = vi.mocked(
      window.electron.session.setStackedDeckPriceOverride,
    );
    update.mockClear();
    await user.paste("1000");
    expect(input).toHaveValue("");
    expect(update).not.toHaveBeenCalled();
  });

  it("rounds long snapshot prices instead of displaying a clipped decimal string", () => {
    store = createTestStore({
      currentSession: {
        poe1Session: makeDetailedSession({
          priceSnapshot: {
            timestamp: "2026-11-16",
            stackedDeckChaosCost: 1.689999,
            chaosToDivineRatio: 154.13,
            cardPrices: {},
          },
        }),
      },
    });
    renderWithProviders(<StackedDeckPriceInput />);
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "1.69");
    expect(
      store.getState().currentSession.poe1Session?.priceSnapshot
        ?.stackedDeckChaosCost,
    ).toBe(1.689999);
  });

  it("keeps the snapshot price as a placeholder when a custom price is set", () => {
    store = createTestStore({
      currentSession: {
        stackedDeckPriceOverrides: { poe1: 2.25, poe2: null },
        poe1Session: makeDetailedSession({
          priceSnapshot: {
            timestamp: "2026-11-16",
            stackedDeckChaosCost: 3,
            chaosToDivineRatio: 100,
            cardPrices: {},
          },
        }),
      },
    });
    renderWithProviders(<StackedDeckPriceInput />);
    expect(screen.getByRole("textbox")).toHaveValue("2.25");
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "3.00");
  });

  it("rejects negative prices", () => {
    renderWithProviders(<StackedDeckPriceInput />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "-1" },
    });
    expect(
      window.electron.session.setStackedDeckPriceOverride,
    ).not.toHaveBeenCalled();
  });

  it("shows save failures", async () => {
    const electron = window.electron as unknown as ElectronMock;
    electron.session.setStackedDeckPriceOverride.mockResolvedValue({
      success: false,
    });
    const { user } = renderWithProviders(<StackedDeckPriceInput />);
    await user.type(screen.getByRole("textbox"), "2");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to save the deck price",
    );
  });
});
