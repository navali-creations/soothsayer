import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  act,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { trackEvent } from "~/renderer/modules/umami";
import { useSettings } from "~/renderer/store";

import AudioSettingsCard from "./AudioSettingsCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useSettings: vi.fn(),
}));

const mockUseSettings = vi.mocked(useSettings);

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, disabled, loading, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {loading ? "Loading..." : children}
    </button>
  ),
}));

vi.mock("~/renderer/assets/audio/rarity1.mp3", () => ({
  default: "rarity1.mp3",
}));
vi.mock("~/renderer/assets/audio/rarity2.mp3", () => ({
  default: "rarity2.mp3",
}));
vi.mock("~/renderer/assets/audio/rarity3.mp3", () => ({
  default: "rarity3.mp3",
}));

vi.mock("~/renderer/utils", () => ({
  RARITY_LABELS: { 1: "Common", 2: "Uncommon", 3: "Rare" },
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("react-icons/fi", () => ({
  FiFolder: () => <span data-testid="icon-folder" />,
  FiPlay: () => <span data-testid="icon-play" />,
  FiRefreshCw: () => <span data-testid="icon-refresh" />,
  FiSquare: () => <span data-testid="icon-square" />,
  FiX: () => <span data-testid="icon-x" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockSettings(overrides: any = {}) {
  return {
    audioDetectedFiles: [],
    audioIsScanning: false,
    audioPreviewingFile: null,
    scanCustomSounds: vi.fn().mockResolvedValue(undefined),
    setAudioPreviewingFile: vi.fn(),
    updateSetting: vi.fn().mockResolvedValue(undefined),
    audioEnabled: true,
    audioVolume: 0.5,
    audioRarity1Path: null,
    audioRarity2Path: null,
    audioRarity3Path: null,
    ...overrides.settings,
  } as any;
}

function setupStore(overrides: any = {}) {
  const settings = createMockSettings(overrides);
  mockUseSettings.mockReturnValue(settings);
  return { settings };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

// ─── Audio mock ────────────────────────────────────────────────────────────

let mockAudioInstances: any[] = [];

function createMockAudioClass() {
  mockAudioInstances = [];
  const MockAudio = vi.fn(function (this: any, src?: string) {
    this.src = src ?? "";
    this.volume = 1;
    this.play = vi.fn().mockResolvedValue(undefined);
    this.pause = vi.fn();
    this.onended = null as (() => void) | null;
    mockAudioInstances.push(this);
  });
  return MockAudio;
}

describe("AudioSettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();

    // Fresh Audio mock per test
    (window as any).Audio = createMockAudioClass();

    // Ensure electron settings mocks are present (global setup installs them,
    // but we override to control return values per-test)
    window.electron.settings.openCustomSoundsFolder = vi
      .fn()
      .mockResolvedValue(undefined);
    window.electron.settings.getCustomSoundData = vi
      .fn()
      .mockResolvedValue(null);
  });

  afterEach(() => {
    mockAudioInstances = [];
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  it('renders "Audio" title', () => {
    renderWithProviders(<AudioSettingsCard />);

    expect(screen.getByRole("heading", { name: /Audio/i })).toBeInTheDocument();
  });

  it("renders audio enable toggle", () => {
    renderWithProviders(<AudioSettingsCard />);

    expect(screen.getByText("Enable drop sounds")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  // ── Toggle interaction ─────────────────────────────────────────────────

  it('toggle calls updateSetting("audioEnabled", ...)', async () => {
    const store = setupStore({ settings: { audioEnabled: true } });
    const { user } = renderWithProviders(<AudioSettingsCard />);

    const toggle = screen.getByRole("checkbox");
    await user.click(toggle);

    await waitFor(() => {
      expect(store.settings.updateSetting).toHaveBeenCalledWith(
        "audioEnabled",
        false,
      );
    });
  });

  // ── Volume slider ─────────────────────────────────────────────────────

  it("renders volume slider", () => {
    renderWithProviders(<AudioSettingsCard />);

    expect(screen.getByText("Volume")).toBeInTheDocument();
    const sliders = screen.getAllByRole("slider");
    // The first slider is the volume slider
    expect(sliders[0]).toBeInTheDocument();
  });

  it("volume slider shows correct percentage (50%)", () => {
    setupStore({ settings: { audioVolume: 0.5 } });
    renderWithProviders(<AudioSettingsCard />);

    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  // ── Custom Sounds divider ──────────────────────────────────────────────

  it('renders "Custom Sounds" divider', () => {
    renderWithProviders(<AudioSettingsCard />);

    expect(screen.getByText("Custom Sounds")).toBeInTheDocument();
  });

  // ── Scan / Load button ────────────────────────────────────────────────

  it("renders scan/load button", () => {
    renderWithProviders(<AudioSettingsCard />);

    expect(
      screen.getByRole("button", { name: /Load sounds/i }),
    ).toBeInTheDocument();
  });

  it("scan button calls scanCustomSounds()", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<AudioSettingsCard />);

    const scanButton = screen.getByRole("button", { name: /Load sounds/i });
    await user.click(scanButton);

    await waitFor(() => {
      expect(store.settings.scanCustomSounds).toHaveBeenCalledTimes(1);
    });
  });

  it("scan button is disabled when audioIsScanning", () => {
    setupStore({ settings: { audioIsScanning: true } });
    renderWithProviders(<AudioSettingsCard />);

    // When scanning, the button shows loading text
    const scanButton = screen.getByRole("button", { name: /Loading.../i });
    expect(scanButton).toBeDisabled();
  });

  it("scan button is disabled when audioEnabled is false", () => {
    setupStore({ settings: { audioEnabled: false } });
    renderWithProviders(<AudioSettingsCard />);

    const scanButton = screen.getByRole("button", { name: /Load sounds/i });
    expect(scanButton).toBeDisabled();
  });

  // ── Detected files count ──────────────────────────────────────────────

  it("shows count when detected files exist", () => {
    setupStore({
      settings: {
        audioDetectedFiles: [
          { filename: "sound1.mp3", fullPath: "/path/sound1.mp3" },
          { filename: "sound2.mp3", fullPath: "/path/sound2.mp3" },
        ],
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    expect(screen.getByText("2 sounds found")).toBeInTheDocument();
  });

  it('shows "Refresh sounds" when detected files exist', () => {
    setupStore({
      settings: {
        audioDetectedFiles: [
          { filename: "sound1.mp3", fullPath: "/path/sound1.mp3" },
        ],
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    expect(
      screen.getByRole("button", { name: /Refresh sounds/i }),
    ).toBeInTheDocument();
  });

  // ── Rarity labels ─────────────────────────────────────────────────────

  it("renders rarity labels (Common, Uncommon, Rare)", () => {
    renderWithProviders(<AudioSettingsCard />);

    expect(screen.getByText("Common")).toBeInTheDocument();
    expect(screen.getByText("Uncommon")).toBeInTheDocument();
    expect(screen.getByText("Rare")).toBeInTheDocument();
  });

  // ── Rarity select dropdowns and preview buttons ────────────────────────

  it("each rarity has a select dropdown and preview button", () => {
    renderWithProviders(<AudioSettingsCard />);

    // 3 rarity selects
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(3);

    // 3 preview buttons (one per rarity)
    const previewButtons = screen.getAllByTitle("Preview");
    expect(previewButtons).toHaveLength(3);
  });

  it('select shows "Default (bundled)" option', () => {
    renderWithProviders(<AudioSettingsCard />);

    const selects = screen.getAllByRole("combobox");
    for (const select of selects) {
      expect(select).toHaveTextContent("Default (bundled)");
    }
  });

  it("select shows detected custom sounds as options", () => {
    setupStore({
      settings: {
        audioDetectedFiles: [
          { filename: "custom_drop.mp3", fullPath: "/sounds/custom_drop.mp3" },
          { filename: "epic_sound.mp3", fullPath: "/sounds/epic_sound.mp3" },
        ],
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    const selects = screen.getAllByRole("combobox");
    // Each select should contain both custom sound options
    for (const select of selects) {
      expect(select).toHaveTextContent("custom_drop.mp3");
      expect(select).toHaveTextContent("epic_sound.mp3");
    }
  });

  // ── Volume slider disabled when audio disabled ─────────────────────────

  it("volume slider is disabled when audioEnabled is false", () => {
    setupStore({ settings: { audioEnabled: false } });
    renderWithProviders(<AudioSettingsCard />);

    const sliders = screen.getAllByRole("slider");
    expect(sliders[0]).toBeDisabled();
  });

  // ── Rarity selects disabled when audio disabled ────────────────────────

  it("rarity selects are disabled when audioEnabled is false", () => {
    setupStore({ settings: { audioEnabled: false } });
    renderWithProviders(<AudioSettingsCard />);

    const selects = screen.getAllByRole("combobox");
    for (const select of selects) {
      expect(select).toBeDisabled();
    }
  });

  // ── handleOpenFolder ─────────────────────────────────────────────────

  it('"Find sounds" button calls openCustomSoundsFolder and tracks event', async () => {
    renderWithProviders(<AudioSettingsCard />);

    const findButton = screen.getByRole("button", { name: /Find sounds/i });
    await userEvent.setup().click(findButton);

    await waitFor(() => {
      expect(
        window.electron.settings.openCustomSoundsFolder,
      ).toHaveBeenCalledTimes(1);
    });
    expect(trackEvent).toHaveBeenCalledWith("audio-open-sounds-folder");
  });

  // ── Volume slider onChange ─────────────────────────────────────────────

  it("volume slider onChange calls updateSetting with parsed float value", async () => {
    const store = setupStore({ settings: { audioVolume: 0.5 } });
    renderWithProviders(<AudioSettingsCard />);

    const sliders = screen.getAllByRole("slider");
    const volumeSlider = sliders[0];

    fireEvent.change(volumeSlider, { target: { value: "0.75" } });

    await waitFor(() => {
      expect(store.settings.updateSetting).toHaveBeenCalledWith(
        "audioVolume",
        0.75,
      );
    });
  });

  // ── handleAssignSound — selecting a custom sound ───────────────────────

  it("selecting a custom sound in dropdown calls updateSetting with fullPath", async () => {
    const store = setupStore({
      settings: {
        audioDetectedFiles: [
          { filename: "boom.mp3", fullPath: "/sounds/boom.mp3" },
        ],
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    const selects = screen.getAllByRole("combobox");
    // Change the first rarity dropdown to the custom sound
    fireEvent.change(selects[0], { target: { value: "/sounds/boom.mp3" } });

    await waitFor(() => {
      expect(store.settings.updateSetting).toHaveBeenCalledWith(
        "audioRarity1Path",
        "/sounds/boom.mp3",
      );
    });
    expect(trackEvent).toHaveBeenCalledWith("audio-assign-sound", {
      rarity: 1,
      type: "custom",
    });
  });

  // ── handleAssignSound — selecting "Default (bundled)" ──────────────────

  it('selecting "Default (bundled)" calls updateSetting with null', async () => {
    const store = setupStore({
      settings: {
        audioDetectedFiles: [
          { filename: "boom.mp3", fullPath: "/sounds/boom.mp3" },
        ],
        audioRarity1Path: "/sounds/boom.mp3",
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    const selects = screen.getAllByRole("combobox");
    // Change back to default (empty string value)
    fireEvent.change(selects[0], { target: { value: "" } });

    await waitFor(() => {
      expect(store.settings.updateSetting).toHaveBeenCalledWith(
        "audioRarity1Path",
        null,
      );
    });
    expect(trackEvent).toHaveBeenCalledWith("audio-assign-sound", {
      rarity: 1,
      type: "default",
    });
  });

  // ── Reset button (FiX) ────────────────────────────────────────────────

  it("reset button is visible when custom path is assigned", () => {
    setupStore({
      settings: {
        audioRarity2Path: "/sounds/custom.mp3",
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    const resetButtons = screen.getAllByTitle("Reset to default");
    expect(resetButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("reset button is not visible when using default sound", () => {
    setupStore({
      settings: {
        audioRarity1Path: null,
        audioRarity2Path: null,
        audioRarity3Path: null,
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    expect(screen.queryAllByTitle("Reset to default")).toHaveLength(0);
  });

  it("clicking reset button calls updateSetting with null for that rarity", async () => {
    const store = setupStore({
      settings: {
        audioRarity1Path: "/sounds/custom.mp3",
        audioDetectedFiles: [
          { filename: "custom.mp3", fullPath: "/sounds/custom.mp3" },
        ],
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    const resetButton = screen.getAllByTitle("Reset to default")[0];
    await userEvent.setup().click(resetButton);

    await waitFor(() => {
      expect(store.settings.updateSetting).toHaveBeenCalledWith(
        "audioRarity1Path",
        null,
      );
    });
  });

  // ── handlePreview — default (bundled) sound ────────────────────────────

  it("clicking preview on a default rarity creates Audio with bundled source", async () => {
    const store = setupStore({
      settings: {
        audioVolume: 0.7,
        audioRarity1Path: null,
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    const previewButtons = screen.getAllByTitle("Preview");
    await userEvent.setup().click(previewButtons[0]);

    await waitFor(() => {
      expect(mockAudioInstances).toHaveLength(1);
    });

    const audio = mockAudioInstances[0];
    expect(audio.src).toBe("rarity1.mp3");
    expect(audio.volume).toBe(0.7);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(store.settings.setAudioPreviewingFile).toHaveBeenCalledWith(
      "rarity1.mp3",
    );
    expect(trackEvent).toHaveBeenCalledWith("audio-preview-rarity", {
      rarity: 1,
      type: "default",
    });
  });

  // ── handlePreview — custom sound ──────────────────────────────────────

  it("clicking preview on a custom rarity calls getCustomSoundData and plays", async () => {
    const store = setupStore({
      settings: {
        audioVolume: 0.6,
        audioRarity1Path: "/sounds/boom.mp3",
        audioDetectedFiles: [
          { filename: "boom.mp3", fullPath: "/sounds/boom.mp3" },
        ],
      },
    });
    (
      window.electron.settings.getCustomSoundData as ReturnType<typeof vi.fn>
    ).mockResolvedValue("data:audio/mp3;base64,abc123");
    renderWithProviders(<AudioSettingsCard />);

    const previewButtons = screen.getAllByTitle("Preview");
    await userEvent.setup().click(previewButtons[0]);

    await waitFor(() => {
      expect(window.electron.settings.getCustomSoundData).toHaveBeenCalledWith(
        "/sounds/boom.mp3",
      );
    });

    await waitFor(() => {
      expect(mockAudioInstances).toHaveLength(1);
    });

    const audio = mockAudioInstances[0];
    expect(audio.src).toBe("data:audio/mp3;base64,abc123");
    expect(audio.volume).toBe(0.6);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(store.settings.setAudioPreviewingFile).toHaveBeenCalledWith(
      "/sounds/boom.mp3",
    );
    expect(trackEvent).toHaveBeenCalledWith("audio-preview-sound", {
      type: "custom",
    });
  });

  // ── handlePreview — getCustomSoundData returns null → early return ─────

  it("does not create Audio when getCustomSoundData returns null", async () => {
    setupStore({
      settings: {
        audioRarity1Path: "/sounds/missing.mp3",
        audioDetectedFiles: [
          { filename: "missing.mp3", fullPath: "/sounds/missing.mp3" },
        ],
      },
    });
    (
      window.electron.settings.getCustomSoundData as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    renderWithProviders(<AudioSettingsCard />);

    const previewButtons = screen.getAllByTitle("Preview");
    await userEvent.setup().click(previewButtons[0]);

    await waitFor(() => {
      expect(window.electron.settings.getCustomSoundData).toHaveBeenCalledWith(
        "/sounds/missing.mp3",
      );
    });

    // Audio should not have been constructed
    expect(mockAudioInstances).toHaveLength(0);
  });

  // ── handlePreview — toggle off when clicking same source ───────────────

  it("clicking preview again on same source stops playback (toggle off)", async () => {
    const store = setupStore({
      settings: {
        audioVolume: 0.5,
        audioRarity1Path: null,
        // Simulate that we're already previewing rarity1's bundled sound
        audioPreviewingFile: "rarity1.mp3",
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    const previewButtons = screen.getAllByTitle("Preview");
    await userEvent.setup().click(previewButtons[0]);

    await waitFor(() => {
      expect(store.settings.setAudioPreviewingFile).toHaveBeenCalledWith(null);
    });

    // No new Audio should be created since we toggled off
    expect(mockAudioInstances).toHaveLength(0);
  });

  // ── handlePreview — audio.onended clears preview state ─────────────────

  it("audio onended callback clears the previewing file state", async () => {
    const store = setupStore({
      settings: {
        audioVolume: 0.5,
        audioRarity1Path: null,
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    const previewButtons = screen.getAllByTitle("Preview");
    await userEvent.setup().click(previewButtons[0]);

    await waitFor(() => {
      expect(mockAudioInstances).toHaveLength(1);
    });

    const audio = mockAudioInstances[0];
    expect(audio.onended).toBeTypeOf("function");

    // Simulate the audio finishing
    act(() => {
      audio.onended!();
    });

    // setAudioPreviewingFile should be called with null from onended
    // First call is with the source, second call is from onended
    expect(store.settings.setAudioPreviewingFile).toHaveBeenCalledWith(null);
  });

  // ── handlePreview — error handling ─────────────────────────────────────

  it("when audio.play() rejects, logs error and resets preview state", async () => {
    const store = setupStore({
      settings: {
        audioVolume: 0.5,
        audioRarity1Path: null,
      },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithProviders(<AudioSettingsCard />);

    // Make the next Audio instance's play() reject
    (window as any).Audio = vi.fn(function (this: any, src?: string) {
      this.src = src ?? "";
      this.volume = 1;
      this.play = vi.fn().mockRejectedValue(new Error("Play failed"));
      this.pause = vi.fn();
      this.onended = null;
      mockAudioInstances.push(this);
    });

    const previewButtons = screen.getAllByTitle("Preview");
    await userEvent.setup().click(previewButtons[0]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to preview sound:",
        expect.any(Error),
      );
    });

    expect(store.settings.setAudioPreviewingFile).toHaveBeenCalledWith(null);
    consoleSpy.mockRestore();
  });

  // ── handlePreview — pauses existing audio before starting new ──────────

  it("pauses existing audio before starting a new preview", async () => {
    setupStore({
      settings: {
        audioVolume: 0.5,
        audioRarity1Path: null,
        audioRarity2Path: null,
      },
    });
    renderWithProviders(<AudioSettingsCard />);

    const previewButtons = screen.getAllByTitle("Preview");

    // Click preview for rarity 1
    await userEvent.setup().click(previewButtons[0]);

    await waitFor(() => {
      expect(mockAudioInstances).toHaveLength(1);
    });

    const firstAudio = mockAudioInstances[0];
    expect(firstAudio.pause).not.toHaveBeenCalled();

    // Click preview for rarity 2 — should pause the first audio
    await userEvent.setup().click(previewButtons[1]);

    await waitFor(() => {
      expect(firstAudio.pause).toHaveBeenCalledTimes(1);
    });
  });

  // ── Cleanup effect — pauses audio on unmount ───────────────────────────

  it("pauses and cleans up audio on component unmount", async () => {
    setupStore({
      settings: {
        audioVolume: 0.5,
        audioRarity1Path: null,
      },
    });
    const { unmount } = renderWithProviders(<AudioSettingsCard />);

    const previewButtons = screen.getAllByTitle("Preview");
    await userEvent.setup().click(previewButtons[0]);

    await waitFor(() => {
      expect(mockAudioInstances).toHaveLength(1);
    });

    const audio = mockAudioInstances[0];
    expect(audio.pause).not.toHaveBeenCalled();

    // Unmount the component — cleanup effect should pause the audio
    unmount();

    expect(audio.pause).toHaveBeenCalledTimes(1);
  });

  // ── handlePreviewRarity tracks event with correct type ─────────────────

  it("handlePreviewRarity tracks event with custom type when custom path set", async () => {
    setupStore({
      settings: {
        audioVolume: 0.5,
        audioRarity3Path: "/sounds/rare.mp3",
        audioDetectedFiles: [
          { filename: "rare.mp3", fullPath: "/sounds/rare.mp3" },
        ],
      },
    });
    (
      window.electron.settings.getCustomSoundData as ReturnType<typeof vi.fn>
    ).mockResolvedValue("data:audio/mp3;base64,rare");
    renderWithProviders(<AudioSettingsCard />);

    const previewButtons = screen.getAllByTitle("Preview");
    // Click the 3rd preview button (Rare)
    await userEvent.setup().click(previewButtons[2]);

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith("audio-preview-rarity", {
        rarity: 3,
        type: "custom",
      });
    });
  });
});
