import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  act,
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import OverlaySettingsCard from "./OverlaySettingsCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiMaximize: () => <span data-testid="icon-maximize" />,
  FiMonitor: () => <span data-testid="icon-monitor" />,
  FiType: () => <span data-testid="icon-type" />,
}));

vi.mock("react-icons/lu", () => ({
  LuMoveHorizontal: () => <span data-testid="icon-move-h" />,
  LuMoveVertical: () => <span data-testid="icon-move-v" />,
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUpdateSetting = vi.fn().mockResolvedValue(undefined);
const mockRestoreDefaults = vi.fn().mockResolvedValue(undefined);
const mockSetSize = vi.fn().mockResolvedValue(undefined);
const mockGetBounds = vi.fn().mockResolvedValue(null);
const mockSettingsGet = vi.fn().mockResolvedValue(null);
const mockSettingsSet = vi.fn().mockResolvedValue(undefined);

function createMockStore(overrides: any = {}) {
  return {
    settings: {
      overlayFontSize: 1.0,
      overlayToolbarFontSize: 1.0,
      overlayBounds: { width: 250, height: 175 },
      updateSetting: mockUpdateSetting,
      ...overrides.settings,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);

  mockUseBoundStore.mockImplementation((selector?: any) => {
    return selector ? selector(store) : store;
  });

  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("OverlaySettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.electron APIs used by OverlaySettingsCard
    window.electron = {
      ...window.electron,
      overlay: {
        ...((window.electron?.overlay as any) ?? {}),
        setSize: mockSetSize,
        getBounds: mockGetBounds,
        restoreDefaults: mockRestoreDefaults,
      },
      settings: {
        ...((window.electron?.settings as any) ?? {}),
        get: mockSettingsGet,
        set: mockSettingsSet,
      },
    } as any;

    setupStore();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  it('renders "Overlay" title', () => {
    renderWithProviders(<OverlaySettingsCard />);

    expect(
      screen.getByRole("heading", { name: /Overlay/i }),
    ).toBeInTheDocument();
  });

  it("renders width slider", () => {
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("Width")).toBeInTheDocument();
    const sliders = screen.getAllByRole("slider");
    // Width is the first slider
    expect(sliders[0]).toBeInTheDocument();
  });

  it("renders height slider", () => {
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("Height")).toBeInTheDocument();
    const sliders = screen.getAllByRole("slider");
    // Height is the second slider
    expect(sliders[1]).toBeInTheDocument();
  });

  it("renders drop size (font) slider", () => {
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("Drop size")).toBeInTheDocument();
    const sliders = screen.getAllByRole("slider");
    // Drop size is the third slider
    expect(sliders[2]).toBeInTheDocument();
  });

  it("renders toolbar font size slider", () => {
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("Toolbar")).toBeInTheDocument();
    const sliders = screen.getAllByRole("slider");
    // Toolbar is the fourth slider
    expect(sliders[3]).toBeInTheDocument();
  });

  // ── Displayed values ──────────────────────────────────────────────────

  it("width slider shows current value in px", () => {
    setupStore({ settings: { overlayBounds: { width: 300, height: 175 } } });
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("300px")).toBeInTheDocument();
  });

  it("height slider shows current value in px", () => {
    setupStore({ settings: { overlayBounds: { width: 250, height: 200 } } });
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("200px")).toBeInTheDocument();
  });

  it("font size shows percentage (100%)", () => {
    setupStore({ settings: { overlayFontSize: 1.0 } });
    renderWithProviders(<OverlaySettingsCard />);

    // Both font size and toolbar font size show 100%
    const percentages = screen.getAllByText("100%");
    expect(percentages.length).toBeGreaterThanOrEqual(1);
  });

  it("font size shows scaled percentage (150%)", () => {
    setupStore({
      settings: { overlayFontSize: 1.5, overlayToolbarFontSize: 1.0 },
    });
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("150%")).toBeInTheDocument();
  });

  it("toolbar font size shows percentage", () => {
    setupStore({
      settings: { overlayFontSize: 1.0, overlayToolbarFontSize: 0.5 },
    });
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  // ── Slider interactions ───────────────────────────────────────────────

  it("changing drop size slider calls updateSetting with overlayFontSize", async () => {
    renderWithProviders(<OverlaySettingsCard />);

    const sliders = screen.getAllByRole("slider");
    const fontSizeSlider = sliders[2]; // Drop size is third

    // fireEvent.change is more reliable for range inputs
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(fontSizeSlider, { target: { value: "1.5" } });

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("overlayFontSize", 1.5);
    });
  });

  it("changing toolbar slider calls updateSetting with overlayToolbarFontSize", async () => {
    renderWithProviders(<OverlaySettingsCard />);

    const sliders = screen.getAllByRole("slider");
    const toolbarSlider = sliders[3]; // Toolbar is fourth

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(toolbarSlider, { target: { value: "0.8" } });

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "overlayToolbarFontSize",
        0.8,
      );
    });
  });

  // ── Restore defaults ─────────────────────────────────────────────────

  it('renders "Restore defaults" button', () => {
    renderWithProviders(<OverlaySettingsCard />);

    expect(
      screen.getByRole("button", { name: /Restore defaults/i }),
    ).toBeInTheDocument();
  });

  it("restore defaults calls overlay.restoreDefaults() and updateSetting", async () => {
    const { user } = renderWithProviders(<OverlaySettingsCard />);

    const restoreButton = screen.getByRole("button", {
      name: /Restore defaults/i,
    });
    await user.click(restoreButton);

    await waitFor(() => {
      expect(mockRestoreDefaults).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("overlayFontSize", 1.0);
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "overlayToolbarFontSize",
        1.0,
      );
    });
  });

  // ── Description text ──────────────────────────────────────────────────

  it("renders description text", () => {
    renderWithProviders(<OverlaySettingsCard />);

    expect(
      screen.getByText("Customize the overlay appearance and position"),
    ).toBeInTheDocument();
  });

  it("renders restore defaults description", () => {
    renderWithProviders(<OverlaySettingsCard />);

    expect(
      screen.getByText("Reset position, size, and font sizes to defaults"),
    ).toBeInTheDocument();
  });

  // ── Default bounds from store ─────────────────────────────────────────

  it("uses default width when overlayBounds is null", () => {
    setupStore({ settings: { overlayBounds: null } });
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("250px")).toBeInTheDocument();
  });

  it("uses default height when overlayBounds is null", () => {
    setupStore({ settings: { overlayBounds: null } });
    renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("175px")).toBeInTheDocument();
  });

  // ── Mount effect: fetching bounds ───────────────────────────────────

  it("fetches overlayBounds on mount and updates displayed width/height", async () => {
    mockSettingsGet.mockResolvedValue({
      width: 400,
      height: 300,
      x: 10,
      y: 10,
    });
    renderWithProviders(<OverlaySettingsCard />);

    await waitFor(() => {
      expect(mockSettingsGet).toHaveBeenCalledWith("overlayBounds");
    });

    await waitFor(() => {
      expect(screen.getByText("400px")).toBeInTheDocument();
      expect(screen.getByText("300px")).toBeInTheDocument();
    });
  });

  it("uses defaults when fetched bounds have missing width/height", async () => {
    mockSettingsGet.mockResolvedValue({ x: 10, y: 10 });
    renderWithProviders(<OverlaySettingsCard />);

    await waitFor(() => {
      expect(mockSettingsGet).toHaveBeenCalledWith("overlayBounds");
    });

    await waitFor(() => {
      // Should fall back to defaults: 250 width, 175 height
      expect(screen.getByText("250px")).toBeInTheDocument();
      expect(screen.getByText("175px")).toBeInTheDocument();
    });
  });

  it("handles mount settings.get rejection gracefully", async () => {
    mockSettingsGet.mockRejectedValue(new Error("db error"));
    // Should not throw
    renderWithProviders(<OverlaySettingsCard />);

    await waitFor(() => {
      expect(mockSettingsGet).toHaveBeenCalledWith("overlayBounds");
    });

    // Component still renders with store defaults
    expect(screen.getByText("250px")).toBeInTheDocument();
    expect(screen.getByText("175px")).toBeInTheDocument();
  });

  // ── Width / Height slider handlers ────────────────────────────────

  it("changing width slider updates displayed value and calls resizeOverlay", async () => {
    renderWithProviders(<OverlaySettingsCard />);

    const sliders = screen.getAllByRole("slider");
    const widthSlider = sliders[0];

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(widthSlider, { target: { value: "350" } });

    await waitFor(() => {
      expect(screen.getByText("350px")).toBeInTheDocument();
    });

    expect(mockSetSize).toHaveBeenCalledWith(350, 175);
  });

  it("changing height slider updates displayed value and calls resizeOverlay", async () => {
    renderWithProviders(<OverlaySettingsCard />);

    const sliders = screen.getAllByRole("slider");
    const heightSlider = sliders[1];

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(heightSlider, { target: { value: "220" } });

    await waitFor(() => {
      expect(screen.getByText("220px")).toBeInTheDocument();
    });

    expect(mockSetSize).toHaveBeenCalledWith(250, 220);
  });

  // ── resizeOverlay fallback path ───────────────────────────────────

  describe("resizeOverlay fallback (overlay not open)", () => {
    // Helper: flush the microtask queue so `.catch()` / `.then()` handlers run
    const flushPromises = () => act(async () => {});

    beforeEach(() => {
      vi.useFakeTimers();
      mockSetSize.mockRejectedValue(new Error("not open"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("debounces fallback save and calls getBounds then settings.set with getBounds result", async () => {
      mockGetBounds.mockResolvedValue({
        x: 50,
        y: 60,
        width: 250,
        height: 175,
      });

      renderWithProviders(<OverlaySettingsCard />);

      const sliders = screen.getAllByRole("slider");
      const widthSlider = sliders[0];

      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(widthSlider, { target: { value: "320" } });

      // Flush the rejected-promise .catch() so setTimeout is scheduled
      await flushPromises();

      // Advance past the 300ms debounce and flush the async callback inside it
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      // Flush any remaining microtasks from getBounds/settings.set chains
      await flushPromises();

      expect(mockGetBounds).toHaveBeenCalled();
      expect(mockSettingsSet).toHaveBeenCalledWith("overlayBounds", {
        x: 50,
        y: 60,
        width: 320,
        height: 175,
      });
    });

    it("uses default position when getBounds returns null", async () => {
      mockGetBounds.mockResolvedValue(null);

      renderWithProviders(<OverlaySettingsCard />);

      const sliders = screen.getAllByRole("slider");
      const heightSlider = sliders[1];

      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(heightSlider, { target: { value: "200" } });

      // Flush the rejected-promise .catch() so setTimeout is scheduled
      await flushPromises();

      // Advance past the 300ms debounce and flush the async callback inside it
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await flushPromises();

      expect(mockGetBounds).toHaveBeenCalled();
      expect(mockSettingsSet).toHaveBeenCalledWith("overlayBounds", {
        x: 20,
        y: 20,
        width: 250,
        height: 200,
      });
    });

    it("clears previous debounce timer when slider changes rapidly", async () => {
      mockGetBounds.mockResolvedValue(null);

      renderWithProviders(<OverlaySettingsCard />);

      const sliders = screen.getAllByRole("slider");
      const widthSlider = sliders[0];

      const { fireEvent } = await import("@testing-library/react");

      // First change
      fireEvent.change(widthSlider, { target: { value: "300" } });

      // Flush the rejected-promise .catch() so the first setTimeout is scheduled
      await flushPromises();

      // Advance only 100ms (less than 300ms debounce)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Second change before debounce fires — should clear and reset the timer
      fireEvent.change(widthSlider, { target: { value: "350" } });

      // Flush the second rejected-promise .catch()
      await flushPromises();

      // Advance past the new 300ms debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await flushPromises();

      // settings.set should only have been called once (from the second debounce), not twice
      expect(mockSettingsSet).toHaveBeenCalledTimes(1);
      expect(mockSettingsSet).toHaveBeenCalledWith("overlayBounds", {
        x: 20,
        y: 20,
        width: 350,
        height: 175,
      });
    });

    it("falls back to default bounds when getBounds rejects", async () => {
      mockGetBounds.mockRejectedValue(new Error("no overlay"));

      renderWithProviders(<OverlaySettingsCard />);

      const sliders = screen.getAllByRole("slider");
      const widthSlider = sliders[0];

      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(widthSlider, { target: { value: "310" } });

      // Flush the rejected-promise .catch() so setTimeout is scheduled
      await flushPromises();

      // Advance past the 300ms debounce and flush the async callback inside it
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      await flushPromises();

      expect(mockGetBounds).toHaveBeenCalled();
      // getBounds rejected → .catch(() => null) → uses default {x:20, y:20}
      expect(mockSettingsSet).toHaveBeenCalledWith("overlayBounds", {
        x: 20,
        y: 20,
        width: 310,
        height: 175,
      });
    });
  });

  // ── Cleanup effect ────────────────────────────────────────────────

  it("clears fallback save timer on unmount", async () => {
    vi.useFakeTimers();
    mockSetSize.mockRejectedValue(new Error("not open"));

    const flushPromises = () => act(async () => {});

    const { unmount } = renderWithProviders(<OverlaySettingsCard />);

    const sliders = screen.getAllByRole("slider");
    const widthSlider = sliders[0];

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(widthSlider, { target: { value: "320" } });

    // Flush the rejected-promise .catch() so setTimeout is scheduled
    await flushPromises();

    // Unmount before the 300ms debounce fires
    unmount();

    // Advance past the debounce — getBounds should NOT be called because timer was cleared
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await flushPromises();

    expect(mockGetBounds).not.toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  // ── Restore defaults cancels pending fallback timer ───────────────

  it("restore defaults cancels a pending fallback save timer", async () => {
    vi.useFakeTimers();
    mockSetSize.mockRejectedValue(new Error("not open"));

    const flushPromises = () => act(async () => {});

    renderWithProviders(<OverlaySettingsCard />);

    const sliders = screen.getAllByRole("slider");
    const widthSlider = sliders[0];

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(widthSlider, { target: { value: "320" } });

    // Flush the rejected-promise .catch() so the fallback setTimeout is scheduled
    await flushPromises();

    // Now click restore defaults — it should clear the pending timer
    // Use fireEvent.click instead of user.click to avoid fake-timer deadlock
    const restoreButton = screen.getByRole("button", {
      name: /Restore defaults/i,
    });
    await act(async () => {
      fireEvent.click(restoreButton);
    });

    // Flush the async handleRestoreDefaults promise chain
    await flushPromises();

    // Advance past the 300ms debounce — the fallback should NOT fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await flushPromises();

    // getBounds/settings.set from the fallback path should NOT have been called
    expect(mockGetBounds).not.toHaveBeenCalled();
    expect(mockSettingsSet).not.toHaveBeenCalled();

    // But restoreDefaults itself was called
    expect(mockRestoreDefaults).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  // ── overlayBounds sync effect ─────────────────────────────────────

  it("syncs local state when overlayBounds changes externally", async () => {
    const store = setupStore({
      settings: { overlayBounds: { width: 250, height: 175 } },
    });

    const { rerender } = renderWithProviders(<OverlaySettingsCard />);

    expect(screen.getByText("250px")).toBeInTheDocument();
    expect(screen.getByText("175px")).toBeInTheDocument();

    // Simulate overlayBounds changing externally (e.g. after restore defaults)
    store.settings.overlayBounds = { width: 400, height: 300 };
    // Re-setup the mock to return updated store
    mockUseBoundStore.mockImplementation((selector?: any) => {
      return selector ? selector(store) : store;
    });

    rerender(<OverlaySettingsCard />);

    await waitFor(() => {
      expect(screen.getByText("400px")).toBeInTheDocument();
      expect(screen.getByText("300px")).toBeInTheDocument();
    });
  });
});
