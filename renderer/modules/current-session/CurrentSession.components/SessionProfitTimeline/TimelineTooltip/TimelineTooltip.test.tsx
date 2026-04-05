// ─── Tests for computePortalTooltipStyle, TooltipInlineCard, TimelineTooltipContent ─

import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock variables (available to vi.mock factories) ────────────────

const { DivinationCardMock, mockCurrentGetSession, mockDetailsGetSession } =
  vi.hoisted(() => {
    const DivinationCardMock = vi.fn((_props?: any): any => null);
    const mockCurrentGetSession = vi.fn(() => null as any);
    const mockDetailsGetSession = vi.fn(() => null as any);
    return { DivinationCardMock, mockCurrentGetSession, mockDetailsGetSession };
  });

// ─── Mocks (vi.mock calls are hoisted) ──────────────────────────────────────

vi.mock("~/renderer/components/DivinationCard", () => ({
  default: DivinationCardMock,
}));

vi.mock("~/renderer/store", () => ({
  useBoundStore: () => ({
    currentSession: { getSession: mockCurrentGetSession },
    sessionDetails: { getSession: mockDetailsGetSession },
  }),
  useCurrentSession: () => ({ getSession: mockCurrentGetSession }),
  useSessionDetails: () => ({ getSession: mockDetailsGetSession }),
}));

vi.mock("~/renderer/utils", () => ({
  formatCurrency: (v: number, _ratio?: number) => String(v),
}));

vi.mock("../canvas-utils/canvas-utils", () => ({
  BAR_COLOR: "rgba(255, 255, 255, 0.85)",
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import type { ProfitChartPoint } from "../types/types";
import type { TooltipState } from "../useTimelineInteractions/useTimelineInteractions";
import {
  computePortalTooltipStyle,
  TimelineTooltipContent,
  TOOLTIP_CARD_HEIGHT,
  TOOLTIP_CARD_STATS_GAP,
  TOOLTIP_MARGIN,
  TOOLTIP_OFFSET_X,
  TOOLTIP_STATS_HEIGHT,
  TOOLTIP_VERTICAL_NUDGE,
  TOOLTIP_WIDTH,
  TooltipInlineCard,
} from "./TimelineTooltip";

// ─── Helpers ────────────────────────────────────────────────────────────────

const TOTAL_HEIGHT =
  TOOLTIP_CARD_HEIGHT + TOOLTIP_CARD_STATS_GAP + TOOLTIP_STATS_HEIGHT;

function makePoint(overrides?: Partial<ProfitChartPoint>): ProfitChartPoint {
  return {
    x: 1,
    profit: 100,
    barValue: 50,
    cardName: "The Doctor",
    rarity: 3,
    ...overrides,
  };
}

function makeTooltip(overrides?: Partial<TooltipState>): TooltipState {
  return {
    visible: true,
    x: 100,
    y: 50,
    point: makePoint(),
    ...overrides,
  };
}

function makeContainerRect(overrides?: Partial<DOMRect>): DOMRect {
  return {
    x: 50,
    y: 200,
    width: 600,
    height: 400,
    top: 200,
    right: 650,
    bottom: 600,
    left: 50,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
    configurable: true,
  });
}

function makeCardEntry(
  name: string,
  hasDivinationCard: boolean
): Record<string, unknown> {
  return {
    name,
    count: 1,
    ...(hasDivinationCard
      ? { divinationCard: { name, artFilename: "art.png" } }
      : {}),
  };
}

// ─── Tests: computePortalTooltipStyle ───────────────────────────────────────

describe("computePortalTooltipStyle", () => {
  beforeEach(() => {
    // Default to a large viewport so nothing overflows by default
    setViewport(1920, 1080);
  });

  // ── Hidden states ───────────────────────────────────────────────────────

  it("returns display:none when tooltip is not visible", () => {
    const tooltip = makeTooltip({ visible: false });
    const result = computePortalTooltipStyle(tooltip, makeContainerRect());
    expect(result).toEqual({ display: "none" });
  });

  it("returns display:none when point is null", () => {
    const tooltip = makeTooltip({ point: null });
    const result = computePortalTooltipStyle(tooltip, makeContainerRect());
    expect(result).toEqual({ display: "none" });
  });

  it("returns display:none when containerRect is null", () => {
    const tooltip = makeTooltip();
    const result = computePortalTooltipStyle(tooltip, null);
    expect(result).toEqual({ display: "none" });
  });

  // ── Horizontal positioning ──────────────────────────────────────────────

  it("positions tooltip to the right of cursor when there is space", () => {
    const containerRect = makeContainerRect({ left: 50 });
    const tooltip = makeTooltip({ x: 100 });
    // cursorViewportX = 50 + 100 = 150
    // left = 150 + TOOLTIP_OFFSET_X = 162
    const result = computePortalTooltipStyle(tooltip, containerRect);

    const expectedLeft = 150 + TOOLTIP_OFFSET_X;
    expect(result.left).toBe(`${expectedLeft}px`);
  });

  it("flips tooltip to the left of cursor when it would overflow the right edge", () => {
    // Viewport 500px wide so right placement overflows but left placement fits
    setViewport(500, 1080);

    // cursorViewportX = 50 + 300 = 350
    // initial left = 350 + 12 = 362
    // 362 + 200 = 562 > 500 - 8 = 492 => overflow, flip
    // flipped = 350 - 200 - 12 = 138 >= 8 => no clamp
    const tooltip = makeTooltip({ x: 300 });
    const containerRect = makeContainerRect({ left: 50 });
    const result = computePortalTooltipStyle(tooltip, containerRect);

    const cursorViewportX = 50 + 300; // 350
    const expectedLeft = cursorViewportX - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X; // 138
    expect(result.left).toBe(`${expectedLeft}px`);
  });

  it("clamps left to TOOLTIP_MARGIN when it would go off-screen left", () => {
    // Make viewport narrow so the flipped position goes negative
    setViewport(250, 1080);

    const containerRect = makeContainerRect({ left: 0 });
    const tooltip = makeTooltip({ x: 100 });
    // cursorViewportX = 0 + 100 = 100
    // initial left = 100 + 12 = 112
    // 112 + 200 = 312 > 250 - 8 = 242 => flip
    // flipped = 100 - 200 - 12 = -112
    // -112 < 8 => clamp to 8
    const result = computePortalTooltipStyle(tooltip, containerRect);

    expect(result.left).toBe(`${TOOLTIP_MARGIN}px`);
  });

  // ── Vertical positioning ────────────────────────────────────────────────

  it("positions tooltip with vertical nudge above the container", () => {
    const containerRect = makeContainerRect({ top: 500 });
    const tooltip = makeTooltip();

    const result = computePortalTooltipStyle(tooltip, containerRect);

    const expectedTop = 500 - TOOLTIP_VERTICAL_NUDGE; // 400
    expect(result.top).toBe(`${expectedTop}px`);
  });

  it("clamps top when tooltip would overflow bottom of viewport", () => {
    setViewport(1920, 600);

    // containerRect.top high enough that top + totalHeight overflows
    const containerRect = makeContainerRect({ top: 500 });
    const tooltip = makeTooltip();
    // top = 500 - 100 = 400
    // 400 + TOTAL_HEIGHT > 600 - 8 = 592? => 400 + 380 = 780 > 592 => yes
    // clamped = 600 - 380 - 8 = 212
    const result = computePortalTooltipStyle(tooltip, containerRect);

    const expectedTop = 600 - TOTAL_HEIGHT - TOOLTIP_MARGIN;
    expect(result.top).toBe(`${expectedTop}px`);
  });

  it("clamps top to TOOLTIP_MARGIN when it would go off-screen top", () => {
    // Very small viewport so even the clamped value goes negative
    setViewport(1920, 200);

    const containerRect = makeContainerRect({ top: 50 });
    const tooltip = makeTooltip();
    // top = 50 - 100 = -50
    // -50 + TOTAL_HEIGHT = -50 + 380 = 330 > 200 - 8 = 192 => clamp
    // clamped = 200 - 380 - 8 = -188
    // -188 < 8 => clamp to 8
    const result = computePortalTooltipStyle(tooltip, containerRect);

    expect(result.top).toBe(`${TOOLTIP_MARGIN}px`);
  });

  // ── CSS properties ──────────────────────────────────────────────────────

  it("returns correct CSS properties (position, pointerEvents, zIndex)", () => {
    const tooltip = makeTooltip();
    const containerRect = makeContainerRect();

    const result = computePortalTooltipStyle(tooltip, containerRect);

    expect(result.position).toBe("fixed");
    expect(result.pointerEvents).toBe("none");
    expect(result.zIndex).toBe(9999);
    expect(result.display).toBeUndefined();
    expect(result.left).toMatch(/^\d+(\.\d+)?px$/);
    expect(result.top).toMatch(/^\d+(\.\d+)?px$/);
  });
});

// ─── Tests: TooltipInlineCard ───────────────────────────────────────────────

describe("TooltipInlineCard", () => {
  beforeEach(() => {
    mockCurrentGetSession.mockReset().mockReturnValue(null);
    mockDetailsGetSession.mockReset().mockReturnValue(null);
    DivinationCardMock.mockClear().mockImplementation(() => (
      <div data-testid="divination-card">MockDivinationCard</div>
    ));
  });

  it("returns null when both sessions return null", () => {
    const { container } = render(<TooltipInlineCard cardName="The Doctor" />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when sessions have cards but none match the name", () => {
    mockCurrentGetSession.mockReturnValue({
      cards: [makeCardEntry("House of Mirrors", true)],
    });
    mockDetailsGetSession.mockReturnValue({
      cards: [makeCardEntry("The Fiend", true)],
    });

    const { container } = render(<TooltipInlineCard cardName="The Doctor" />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when card is found but has no divinationCard property", () => {
    mockCurrentGetSession.mockReturnValue({
      cards: [makeCardEntry("The Doctor", false)],
    });

    const { container } = render(<TooltipInlineCard cardName="The Doctor" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders card container with correct dimensions when card is found with divinationCard", () => {
    mockCurrentGetSession.mockReturnValue({
      cards: [makeCardEntry("The Doctor", true)],
    });

    const { container } = render(<TooltipInlineCard cardName="The Doctor" />);

    // The outer wrapper div should have the correct dimensions
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).not.toBeNull();
    expect(outerDiv.style.width).toBe("200px");
    expect(outerDiv.style.height).toBe(`${TOOLTIP_CARD_HEIGHT}px`);
    expect(outerDiv.style.overflow).toBe("hidden");

    // The inner scaling div
    const innerDiv = outerDiv.firstChild as HTMLElement;
    expect(innerDiv.style.transform).toBe("scale(0.625)");
    expect(innerDiv.style.transformOrigin).toBe("top left");
    expect(innerDiv.style.width).toBe("320px");
    expect(innerDiv.style.height).toBe("476px");

    // DivinationCard mock should be rendered
    expect(screen.getByTestId("divination-card")).toBeInTheDocument();
  });

  it("looks up from currentSession first", () => {
    const currentCard = makeCardEntry("The Doctor", true);
    const detailsCard = makeCardEntry("The Doctor", true);

    mockCurrentGetSession.mockReturnValue({ cards: [currentCard] });
    mockDetailsGetSession.mockReturnValue({ cards: [detailsCard] });

    render(<TooltipInlineCard cardName="The Doctor" />);

    // DivinationCard should have been called with the current session's card
    expect(DivinationCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ card: currentCard }),
      undefined
    );
  });

  it("falls back to detailsSession when currentSession has no match", () => {
    const detailsCard = makeCardEntry("The Doctor", true);

    mockCurrentGetSession.mockReturnValue({
      cards: [makeCardEntry("House of Mirrors", true)],
    });
    mockDetailsGetSession.mockReturnValue({ cards: [detailsCard] });

    render(<TooltipInlineCard cardName="The Doctor" />);

    expect(DivinationCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ card: detailsCard }),
      undefined
    );
  });

  it("falls back to detailsSession when currentSession returns null", () => {
    const detailsCard = makeCardEntry("The Doctor", true);

    mockCurrentGetSession.mockReturnValue(null);
    mockDetailsGetSession.mockReturnValue({ cards: [detailsCard] });

    render(<TooltipInlineCard cardName="The Doctor" />);

    expect(DivinationCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ card: detailsCard }),
      undefined
    );
  });
});

// ─── Tests: TimelineTooltipContent ──────────────────────────────────────────

describe("TimelineTooltipContent", () => {
  const defaultTooltipStyle: React.CSSProperties = {
    position: "fixed",
    left: "100px",
    top: "200px",
    pointerEvents: "none",
    zIndex: 9999,
  };

  beforeEach(() => {
    mockCurrentGetSession.mockReset().mockReturnValue(null);
    mockDetailsGetSession.mockReset().mockReturnValue(null);
    DivinationCardMock.mockClear().mockImplementation(() => (
      <div data-testid="divination-card">MockDivinationCard</div>
    ));
  });

  it("renders card value text using formatCurrency", () => {
    const point = makePoint({ barValue: 42, profit: 10 });

    render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    // formatCurrency mock returns String(v), so barValue 42 => "42"
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders net profit with '+' prefix for positive profit", () => {
    const point = makePoint({ profit: 150 });

    const { container } = render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    // The profit div is inside .text-right > div:first-child
    const profitDiv = container.querySelector(
      ".text-right > div:first-child"
    ) as HTMLElement;
    expect(profitDiv).not.toBeNull();
    expect(profitDiv.textContent).toContain("+");
    expect(profitDiv.textContent).toContain("150");
  });

  it("renders net profit without '+' prefix for negative profit", () => {
    const point = makePoint({ profit: -75 });

    const { container } = render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    // formatCurrency(-75) => "-75"; the component should NOT prepend "+"
    const profitDiv = container.querySelector(
      ".text-right > div:first-child"
    ) as HTMLElement;
    expect(profitDiv).not.toBeNull();
    expect(profitDiv.textContent).toContain("-75");
    expect(profitDiv.textContent).not.toContain("+");
  });

  it("applies text-success class for positive profit", () => {
    const point = makePoint({ profit: 100 });

    const { container } = render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    const profitDiv = container.querySelector(
      ".text-right > div:first-child"
    ) as HTMLElement;
    expect(profitDiv).not.toBeNull();
    expect(profitDiv.className).toContain("text-success");
    expect(profitDiv.className).not.toContain("text-error");
  });

  it("applies text-error class for negative profit", () => {
    const point = makePoint({ profit: -50 });

    const { container } = render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    const profitDiv = container.querySelector(
      ".text-right > div:first-child"
    ) as HTMLElement;
    expect(profitDiv).not.toBeNull();
    expect(profitDiv.className).toContain("text-error");
    expect(profitDiv.className).not.toContain("text-success");
  });

  it("applies text-success class when profit is zero", () => {
    const point = makePoint({ profit: 0 });

    const { container } = render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    // profit >= 0 is true for 0, so text-success should be applied
    const profitDiv = container.querySelector(
      ".text-right > div:first-child"
    ) as HTMLElement;
    expect(profitDiv).not.toBeNull();
    expect(profitDiv.className).toContain("text-success");
  });

  it("renders card number with '#' prefix and toLocaleString formatting", () => {
    const point = makePoint({ x: 1234 });

    render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    // toLocaleString on 1234 typically produces "1,234"
    const formatted = (1234).toLocaleString();
    expect(screen.getByText(`#${formatted}`)).toBeInTheDocument();
  });

  it("renders 'Card Value' and 'Net Profit' labels", () => {
    const point = makePoint();

    render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    expect(screen.getByText("Card Value")).toBeInTheDocument();
    expect(screen.getByText("Net Profit")).toBeInTheDocument();
  });

  it("renders 'Card' label next to the card number", () => {
    const point = makePoint({ x: 7 });

    render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    expect(screen.getByText("Card")).toBeInTheDocument();
    expect(screen.getByText("#7")).toBeInTheDocument();
  });

  it("applies tooltipStyle to the outer div", () => {
    const customStyle: React.CSSProperties = {
      position: "fixed",
      left: "42px",
      top: "99px",
      pointerEvents: "none",
      zIndex: 1234,
    };

    const point = makePoint();

    const { container } = render(
      <TimelineTooltipContent
        tooltipStyle={customStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.style.position).toBe("fixed");
    expect(outerDiv.style.left).toBe("42px");
    expect(outerDiv.style.top).toBe("99px");
    expect(outerDiv.style.pointerEvents).toBe("none");
    expect(outerDiv.style.zIndex).toBe("1234");
  });

  it("renders barValue of 0 when barValue is null", () => {
    const point = makePoint({ barValue: null as unknown as number });

    render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    // formatCurrency(0) => "0"
    // The card value section should show "0"
    const cardValueSection = screen.getByText("Card Value");
    const parentDiv = cardValueSection.parentElement!;
    const valueDiv = parentDiv.querySelector("div:first-child") as HTMLElement;
    expect(valueDiv.textContent).toBe("0");
  });

  it("applies BAR_COLOR to the card value text", () => {
    const point = makePoint({ barValue: 55 });

    const { container } = render(
      <TimelineTooltipContent
        tooltipStyle={defaultTooltipStyle}
        point={point}
        chaosToDivineRatio={200}
      />
    );

    // Find the element styled with BAR_COLOR
    const barColorEl = container.querySelector(
      '[style*="rgba(255, 255, 255, 0.85)"]'
    );
    expect(barColorEl).not.toBeNull();
    expect(barColorEl!.textContent).toBe("55");
  });
});
