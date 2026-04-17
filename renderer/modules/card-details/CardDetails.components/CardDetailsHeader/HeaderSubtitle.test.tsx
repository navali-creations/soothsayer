import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/utils", () => ({
  getRarityStyles: (rarity: number) => ({
    badgeBg: `bg-${rarity}`,
    badgeText: `text-${rarity}`,
    badgeBorder: `border-${rarity}`,
  }),
  RARITY_LABELS: {
    0: "Normal",
    1: "Common",
    2: "Uncommon",
    3: "Rare",
    4: "Very Rare",
    5: "Extremely Rare",
  } as Record<number, string>,
}));

vi.mock("~/renderer/components", () => ({
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// ─── Component import (after mocks) ────────────────────────────────────────

import HeaderSubtitle from "./HeaderSubtitle";

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════

describe("HeaderSubtitle", () => {
  it("renders rarity badge with correct label and inline styles", () => {
    renderWithProviders(
      <HeaderSubtitle
        rarity={3 as any}
        fromBoss={false}
        isDisabled={false}
        inPool={true}
      />,
    );
    const badge = screen.getByText("Rare");
    expect(badge).toBeInTheDocument();
    // jsdom doesn't apply non-standard color values, so just verify the style attribute exists
    expect(badge).toHaveStyle({ borderWidth: "1px", borderStyle: "solid" });
  });

  it("falls back to 'Unknown' for unmapped rarity", () => {
    renderWithProviders(
      <HeaderSubtitle
        rarity={99 as any}
        fromBoss={false}
        isDisabled={false}
        inPool={true}
      />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows Boss-exclusive badge when fromBoss is true", () => {
    renderWithProviders(
      <HeaderSubtitle
        rarity={1 as any}
        fromBoss={true}
        isDisabled={false}
        inPool={true}
      />,
    );
    expect(screen.getByText("Boss-exclusive")).toBeInTheDocument();
  });

  it("does not show Boss-exclusive badge when fromBoss is false", () => {
    renderWithProviders(
      <HeaderSubtitle
        rarity={1 as any}
        fromBoss={false}
        isDisabled={false}
        inPool={true}
      />,
    );
    expect(screen.queryByText("Boss-exclusive")).not.toBeInTheDocument();
  });

  it("shows Drop-disabled badge when isDisabled is true", () => {
    renderWithProviders(
      <HeaderSubtitle
        rarity={2 as any}
        fromBoss={false}
        isDisabled={true}
        inPool={true}
      />,
    );
    expect(screen.getByText("Drop-disabled")).toBeInTheDocument();
  });

  it("does not show Drop-disabled badge when isDisabled is false", () => {
    renderWithProviders(
      <HeaderSubtitle
        rarity={2 as any}
        fromBoss={false}
        isDisabled={false}
        inPool={true}
      />,
    );
    expect(screen.queryByText("Drop-disabled")).not.toBeInTheDocument();
  });

  it("shows 'Not in league pool' badge when inPool is false", () => {
    renderWithProviders(
      <HeaderSubtitle
        rarity={1 as any}
        fromBoss={false}
        isDisabled={false}
        inPool={false}
      />,
    );
    expect(screen.getByText("Not in league pool")).toBeInTheDocument();
  });

  it("does not show 'Not in league pool' badge when inPool is true", () => {
    renderWithProviders(
      <HeaderSubtitle
        rarity={1 as any}
        fromBoss={false}
        isDisabled={false}
        inPool={true}
      />,
    );
    expect(screen.queryByText("Not in league pool")).not.toBeInTheDocument();
  });

  it("renders all badges simultaneously when all flags are active", () => {
    renderWithProviders(
      <HeaderSubtitle
        rarity={4 as any}
        fromBoss={true}
        isDisabled={true}
        inPool={false}
      />,
    );
    expect(screen.getByText("Very Rare")).toBeInTheDocument();
    expect(screen.getByText("Boss-exclusive")).toBeInTheDocument();
    expect(screen.getByText("Drop-disabled")).toBeInTheDocument();
    expect(screen.getByText("Not in league pool")).toBeInTheDocument();
  });
});
