import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SetupClientPathStep from "./SetupClientPathStep";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockStore(overrides: any = {}) {
  return {
    setup: {
      setupState: {
        currentStep: 2,
        isComplete: false,
        selectedGames: ["poe1"],
        poe1ClientPath: "",
        poe2ClientPath: "",
        ...overrides.setupState,
      },
      selectClientPath: vi.fn(),
      ...overrides,
    },
  } as any;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupClientPathStep", () => {
  beforeEach(() => {
    mockUseBoundStore.mockReturnValue(createMockStore());
  });

  // ── Heading and description ────────────────────────────────────────────

  describe("heading and description", () => {
    it("renders the heading text", () => {
      renderWithProviders(<SetupClientPathStep />);

      expect(
        screen.getByText("Select Client.txt location"),
      ).toBeInTheDocument();
    });

    it("renders description text about Client.txt", () => {
      renderWithProviders(<SetupClientPathStep />);

      expect(
        screen.getByText(
          "This file is used to track your divination card drops.",
        ),
      ).toBeInTheDocument();
    });
  });

  // ── Path selectors based on selected games ─────────────────────────────

  describe("path selectors", () => {
    it("shows PoE1 path selector when poe1 is selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            selectedGames: ["poe1"],
            poe1ClientPath: "",
            poe2ClientPath: "",
          },
        }),
      );

      renderWithProviders(<SetupClientPathStep />);

      expect(
        screen.getByText("Path of Exile 1 Client.txt"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Path of Exile 2 Client.txt"),
      ).not.toBeInTheDocument();
    });

    it("shows PoE2 path selector when poe2 is selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            selectedGames: ["poe2"],
            poe1ClientPath: "",
            poe2ClientPath: "",
          },
        }),
      );

      renderWithProviders(<SetupClientPathStep />);

      expect(
        screen.getByText("Path of Exile 2 Client.txt"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Path of Exile 1 Client.txt"),
      ).not.toBeInTheDocument();
    });

    it("shows both selectors when both games are selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            selectedGames: ["poe1", "poe2"],
            poe1ClientPath: "",
            poe2ClientPath: "",
          },
        }),
      );

      renderWithProviders(<SetupClientPathStep />);

      expect(
        screen.getByText("Path of Exile 1 Client.txt"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Path of Exile 2 Client.txt"),
      ).toBeInTheDocument();
    });
  });

  // ── Required / success indicators ──────────────────────────────────────

  describe("path status indicators", () => {
    it("shows 'Required' warning when path is empty", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            selectedGames: ["poe1"],
            poe1ClientPath: "",
            poe2ClientPath: "",
          },
        }),
      );

      renderWithProviders(<SetupClientPathStep />);

      expect(screen.getByText("Required")).toBeInTheDocument();
    });

    it("shows success indicator when path is filled", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            selectedGames: ["poe1"],
            poe1ClientPath: "C:\\Games\\PoE\\logs\\Client.txt",
            poe2ClientPath: "",
          },
        }),
      );

      renderWithProviders(<SetupClientPathStep />);

      expect(screen.getByText("✓")).toBeInTheDocument();
      expect(screen.queryByText("Required")).not.toBeInTheDocument();
    });
  });

  // ── Browse button and file selection ───────────────────────────────────

  describe("browse button interaction", () => {
    it("calls window.electron.selectFile when Browse is clicked", async () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            selectedGames: ["poe1"],
            poe1ClientPath: "",
            poe2ClientPath: "",
          },
        }),
      );

      const { user } = renderWithProviders(<SetupClientPathStep />);

      const browseButton = screen.getByText("Browse");
      await user.click(browseButton);

      expect(window.electron.selectFile).toHaveBeenCalledWith({
        title: "Select Path of Exile 1 Client.txt",
        filters: [{ name: "Text Files", extensions: ["txt"] }],
        properties: ["openFile"],
      });
    });

    it("calls selectClientPath with game and path after file selection", async () => {
      const selectClientPath = vi.fn();
      const store = createMockStore({
        selectClientPath,
        setupState: {
          selectedGames: ["poe1"],
          poe1ClientPath: "",
          poe2ClientPath: "",
        },
      });
      mockUseBoundStore.mockReturnValue(store);

      vi.mocked(window.electron.selectFile).mockResolvedValue(
        "C:\\Games\\PoE\\logs\\Client.txt",
      );

      const { user } = renderWithProviders(<SetupClientPathStep />);

      const browseButton = screen.getByText("Browse");
      await user.click(browseButton);

      await waitFor(() => {
        expect(selectClientPath).toHaveBeenCalledWith(
          "poe1",
          "C:\\Games\\PoE\\logs\\Client.txt",
        );
      });
    });

    it("does not call selectClientPath if user cancels file dialog", async () => {
      const selectClientPath = vi.fn();
      const store = createMockStore({
        selectClientPath,
        setupState: {
          selectedGames: ["poe1"],
          poe1ClientPath: "",
          poe2ClientPath: "",
        },
      });
      mockUseBoundStore.mockReturnValue(store);

      // selectFile resolves to undefined when the user cancels
      vi.mocked(window.electron.selectFile).mockResolvedValue(undefined);

      const { user } = renderWithProviders(<SetupClientPathStep />);

      const browseButton = screen.getByText("Browse");
      await user.click(browseButton);

      await waitFor(() => {
        expect(window.electron.selectFile).toHaveBeenCalled();
      });

      expect(selectClientPath).not.toHaveBeenCalled();
    });

    it("calls window.electron.selectFile for PoE2 when PoE2 Browse is clicked", async () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            selectedGames: ["poe2"],
            poe1ClientPath: "",
            poe2ClientPath: "",
          },
        }),
      );

      const { user } = renderWithProviders(<SetupClientPathStep />);

      const browseButton = screen.getByText("Browse");
      await user.click(browseButton);

      expect(window.electron.selectFile).toHaveBeenCalledWith({
        title: "Select Path of Exile 2 Client.txt",
        filters: [{ name: "Text Files", extensions: ["txt"] }],
        properties: ["openFile"],
      });
    });
  });

  // ── Typical paths info box ─────────────────────────────────────────────

  describe("typical paths info box", () => {
    it("shows typical paths info box", () => {
      renderWithProviders(<SetupClientPathStep />);

      expect(screen.getByText("Typical locations:")).toBeInTheDocument();
      expect(screen.getByText("Steam:")).toBeInTheDocument();
      expect(screen.getByText("Standalone:")).toBeInTheDocument();
    });

    it("shows (2) hints when both games are selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            selectedGames: ["poe1", "poe2"],
            poe1ClientPath: "",
            poe2ClientPath: "",
          },
        }),
      );

      renderWithProviders(<SetupClientPathStep />);

      // When both games are selected, (2) markers appear for PoE2 paths
      const markers = screen.getAllByText("(2)");
      expect(markers.length).toBeGreaterThanOrEqual(2);

      expect(
        screen.getByText("(2) = Path of Exile 2 folder"),
      ).toBeInTheDocument();
    });
  });
});
