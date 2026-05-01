import { act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

// ─── Utility mocks ────────────────────────────────────────────────────────

vi.mock("~/renderer/utils", () => ({
  RARITY_LABELS: {
    1: "Extremely Rare",
    2: "Very Rare",
    3: "Rare",
    4: "Common",
  } as Record<number, string>,
}));

// ─── Icon stubs ────────────────────────────────────────────────────────────

vi.mock("react-icons/fi", () => ({
  FiCheck: (props: any) => <span data-testid="icon-check" {...props} />,
  FiCopy: (props: any) => <span data-testid="icon-copy" {...props} />,
}));

// ─── Component import (after all mocks) ────────────────────────────────────

import CardDetailsShareButton from "./CardDetailsShareButton";

// ─── Helpers ───────────────────────────────────────────────────────────────

interface RenderOptions {
  cardName?: string;
  stackSize?: number;
  rarity?: 0 | 1 | 2 | 3 | 4;
  fromBoss?: boolean;
  priceHistory?: any;
  personalAnalytics?: any;
}

function createMockState(
  overrides: Pick<RenderOptions, "priceHistory" | "personalAnalytics"> = {},
) {
  return {
    priceHistory: overrides.priceHistory ?? null,
    personalAnalytics: overrides.personalAnalytics ?? null,
  };
}

function renderComponent(options: RenderOptions = {}) {
  const {
    cardName = "The Doctor",
    stackSize = 8,
    rarity = 1,
    fromBoss = false,
    priceHistory,
    personalAnalytics,
  } = options;

  const mockState = createMockState({ priceHistory, personalAnalytics });
  vi.mocked(useBoundStore).mockReturnValue({
    cardDetails: mockState,
  } as any);

  return renderWithProviders(
    <CardDetailsShareButton
      cardName={cardName}
      stackSize={stackSize}
      rarity={rarity}
      fromBoss={fromBoss}
    />,
  );
}

/**
 * Click the copy button and wait for the async clipboard handler to settle.
 */
async function clickAndWaitForClipboard(
  user: ReturnType<typeof renderComponent>["user"],
) {
  await user.click(screen.getByRole("button"));
  await waitFor(() => {
    // Wait for the microtask (await clipboard.writeText) to settle.
  });
}

// ─── Clipboard mock ────────────────────────────────────────────────────────
//
// jsdom defines navigator.clipboard as a getter-only property, so we must
// use Object.defineProperty once to make it writable.  We then use
// vi.spyOn inside beforeEach so that vi.restoreAllMocks() (called in the
// global afterEach from setup.ts) doesn't silently nuke our mock between
// tests.  The spy is re-created each time, so restoreAllMocks is harmless.
//

const fakeClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

Object.defineProperty(navigator, "clipboard", {
  get: () => fakeClipboard,
  configurable: true,
});

let mockWriteText: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Reset the underlying fn, then layer a spy on top so we can assert.
  fakeClipboard.writeText = vi.fn().mockResolvedValue(undefined);
  mockWriteText = vi.spyOn(navigator.clipboard, "writeText");
});

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Initial render
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsShareButton — initial render", () => {
  it('renders Copy button with "Copy" text', () => {
    renderComponent();
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("renders the copy icon initially (not check icon)", () => {
    renderComponent();
    expect(screen.getByTestId("icon-copy")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-check")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Clipboard interaction
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsShareButton — clipboard content", () => {
  it("clicking Copy calls navigator.clipboard.writeText", async () => {
    const { user } = renderComponent();
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
  });

  it("copied text includes card name", async () => {
    const { user } = renderComponent({ cardName: "House of Mirrors" });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).toContain("House of Mirrors");
  });

  it("copied text includes rarity label", async () => {
    const { user } = renderComponent({ cardName: "The Wretched", rarity: 3 });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).toContain("Rare");
  });

  it("uses Unknown when rarity is not mapped", async () => {
    const { user } = renderComponent({
      cardName: "Mystery Card",
      rarity: 0,
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).toContain("Mystery Card");
    expect(text).toContain("Unknown");
  });

  it('includes "(Boss-exclusive)" when fromBoss is true', async () => {
    const { user } = renderComponent({
      cardName: "The Demon",
      rarity: 1,
      fromBoss: true,
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).toContain("(Boss-exclusive)");
  });

  it('does not include "(Boss-exclusive)" when fromBoss is false', async () => {
    const { user } = renderComponent({
      cardName: "The Doctor",
      rarity: 1,
      fromBoss: false,
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).not.toContain("Boss-exclusive");
  });

  it("includes price when priceHistory.currentDivineRate is set", async () => {
    const { user } = renderComponent({
      priceHistory: { currentDivineRate: 5.2 },
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).toContain("Price: 5.2 div");
  });

  it('includes "Stack: X" when stackSize > 1', async () => {
    const { user } = renderComponent({ stackSize: 8 });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).toContain("Stack: 8");
  });

  it("includes full set value when stackSize > 1 and price available", async () => {
    const { user } = renderComponent({
      stackSize: 8,
      priceHistory: { currentDivineRate: 5.0 },
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    // 5.0 * 8 = 40.0
    expect(text).toContain("Full set: 40.0 div");
  });

  it("omits price line when no priceHistory", async () => {
    const { user } = renderComponent({ priceHistory: null });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).not.toContain("Price:");
  });

  it("omits the entire price details line when no price or stack data exists", async () => {
    const { user } = renderComponent({
      cardName: "Single Line",
      stackSize: 1,
      priceHistory: null,
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text.split("\n")).toEqual(["Single Line — Extremely Rare"]);
  });

  it("includes personal stats when personalAnalytics has drops", async () => {
    const { user } = renderComponent({
      personalAnalytics: {
        totalLifetimeDrops: 10,
        sessionCount: 3,
        firstDiscoveredAt: "2024-01-15T00:00:00Z",
      },
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).toContain("Total drops: 10");
    expect(text).toContain("3 sessions");
  });

  it("omits personal stats when no analytics", async () => {
    const { user } = renderComponent({ personalAnalytics: null });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).not.toContain("Total drops:");
    expect(text).not.toContain("First found:");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Copy feedback
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsShareButton — copy feedback", () => {
  it('shows "Copied!" text after click', async () => {
    const { user } = renderComponent();
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });

  it("shows check icon after copying", async () => {
    const { user } = renderComponent();
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(screen.getByTestId("icon-check")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("icon-copy")).not.toBeInTheDocument();
  });

  it("resets copy feedback after the timeout", async () => {
    vi.useFakeTimers();
    renderComponent();

    fireEvent.click(screen.getByRole("button"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Copied!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByTestId("icon-copy")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Full combined clipboard content
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsShareButton — combined clipboard output", () => {
  it("builds full summary with price, stack, full set, and personal analytics", async () => {
    const { user } = renderComponent({
      cardName: "The Doctor",
      stackSize: 8,
      rarity: 1,
      fromBoss: true,
      priceHistory: { currentDivineRate: 5.0 },
      personalAnalytics: {
        totalLifetimeDrops: 12,
        sessionCount: 4,
        firstDiscoveredAt: "2024-03-10T12:00:00Z",
      },
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    const lines = text.split("\n");

    // Line 1: name — rarity (Boss-exclusive)
    expect(lines[0]).toBe("The Doctor — Extremely Rare (Boss-exclusive)");
    // Line 2: price | stack
    expect(lines[1]).toBe("Price: 5.0 div | Stack: 8");
    // Line 3: full set
    expect(lines[2]).toBe("Full set: 40.0 div");
    // Line 4: personal stats
    expect(lines[3]).toContain("First found:");
    expect(lines[3]).toContain("Total drops: 12 across 4 sessions");
  });

  it("omits Stack when stackSize is 1", async () => {
    const { user } = renderComponent({
      cardName: "Rain of Chaos",
      stackSize: 1,
      rarity: 4,
      fromBoss: false,
      priceHistory: { currentDivineRate: 0.1 },
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).toContain("Price: 0.1 div");
    expect(text).not.toContain("Stack:");
    expect(text).not.toContain("Full set:");
  });

  it("omits firstDiscoveredAt when it is null but still shows drops", async () => {
    const { user } = renderComponent({
      personalAnalytics: {
        totalLifetimeDrops: 3,
        sessionCount: 1,
        firstDiscoveredAt: null,
      },
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).not.toContain("First found:");
    expect(text).toContain("Total drops: 3 across 1 session");
  });

  it("uses singular 'session' when sessionCount is 1", async () => {
    const { user } = renderComponent({
      personalAnalytics: {
        totalLifetimeDrops: 1,
        sessionCount: 1,
        firstDiscoveredAt: null,
      },
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).toMatch(/1 session$/m);
    expect(text).not.toContain("sessions");
  });

  it("skips personal stats when totalLifetimeDrops is 0", async () => {
    const { user } = renderComponent({
      personalAnalytics: {
        totalLifetimeDrops: 0,
        sessionCount: 0,
        firstDiscoveredAt: null,
      },
    });
    await clickAndWaitForClipboard(user);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });
    const text = mockWriteText.mock.calls[0][0] as string;
    expect(text).not.toContain("Total drops:");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Clipboard failure
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsShareButton — clipboard failure", () => {
  it("logs error to console when clipboard.writeText rejects", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockWriteText.mockRejectedValueOnce(new Error("denied"));

    const { user } = renderComponent();
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[CardDetailsShareButton] Failed to copy to clipboard:",
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("does not show Copied! feedback when clipboard write fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockWriteText.mockRejectedValueOnce(new Error("denied"));

    const { user } = renderComponent();
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
