import { vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

// ─── Component mocks ──────────────────────────────────────────────────────

vi.mock("~/renderer/components/CardNameLink/CardNameLink", () => ({
  default: ({ cardName, className }: any) => (
    <span data-testid="card-name-link" className={className}>
      {cardName}
    </span>
  ),
}));

vi.mock("~/renderer/components/DivinationCard/DivinationCard", () => ({
  default: ({ card }: any) => (
    <div data-testid="divination-card">{card.name}</div>
  ),
}));

// ─── Hook mocks ────────────────────────────────────────────────────────────

vi.mock("~/renderer/hooks/usePopover/usePopover", () => ({
  usePopover: () => ({
    triggerRef: { current: null },
    popoverRef: { current: null },
  }),
}));

// ─── Mocked store setup ───────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Import component after mocks ─────────────────────────────────────────

import CardNameCell from "./CardNameCell";

// ─── Helpers ──────────────────────────────────────────────────────────────

function createCellContext(original: Record<string, any>, value?: any) {
  return {
    row: { original },
    getValue: () => value ?? original.name,
    column: { id: "name" },
    cell: { id: "test-cell", getValue: () => value ?? original.name },
    table: {},
    renderValue: () => value ?? original.name,
  } as any;
}

function setupStore(priceSource: "exchange" | "stash" = "exchange") {
  mockUseBoundStore.mockReturnValue({
    settings: {
      getActiveGameViewPriceSource: () => priceSource,
    },
  } as any);
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("CardNameCell", () => {
  beforeEach(() => {
    setupStore("exchange");
  });

  it("renders CardNameLink with card name", () => {
    const ctx = createCellContext({ name: "The Doctor", count: 1 });

    renderWithProviders(<CardNameCell {...ctx} />);

    const link = screen.getByTestId("card-name-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("The Doctor");
  });

  it("without divinationCard data: no popover element and no cursor-help", () => {
    const ctx = createCellContext({ name: "Rain of Chaos", count: 3 });

    const { container } = renderWithProviders(<CardNameCell {...ctx} />);

    expect(screen.queryByTestId("divination-card")).not.toBeInTheDocument();
    expect(
      container.querySelector("[popover='manual']"),
    ).not.toBeInTheDocument();

    const span = screen.getByTestId("card-name-link").parentElement!;
    expect(span).not.toHaveClass("cursor-help");
  });

  it("with divinationCard data: renders popover with DivinationCard and has cursor-help class", () => {
    const ctx = createCellContext({
      name: "The Doctor",
      count: 1,
      divinationCard: { artFilename: "doctor.png" },
    });

    renderWithProviders(<CardNameCell {...ctx} />);

    expect(screen.getByTestId("divination-card")).toBeInTheDocument();

    const span = screen.getByTestId("card-name-link").parentElement!;
    expect(span).toHaveClass("cursor-help");
  });

  it("exchange price source (default): reads hidePrice from exchangePrice", () => {
    setupStore("exchange");

    const ctx = createCellContext({
      name: "The Doctor",
      count: 1,
      exchangePrice: { hidePrice: true, chaosValue: 100 },
      stashPrice: { hidePrice: false, chaosValue: 50 },
    });

    renderWithProviders(<CardNameCell {...ctx} />);

    const link = screen.getByTestId("card-name-link");
    expect(link).toHaveClass("opacity-50", "line-through");
  });

  it("stash price source: reads hidePrice from stashPrice", () => {
    setupStore("stash");

    const ctx = createCellContext({
      name: "The Doctor",
      count: 1,
      exchangePrice: { hidePrice: false, chaosValue: 100 },
      stashPrice: { hidePrice: true, chaosValue: 50 },
    });

    renderWithProviders(<CardNameCell {...ctx} />);

    const link = screen.getByTestId("card-name-link");
    expect(link).toHaveClass("opacity-50", "line-through");
  });

  it("when hidePrice is true: CardNameLink gets 'opacity-50 line-through' className", () => {
    const ctx = createCellContext({
      name: "The Wretched",
      count: 2,
      exchangePrice: { hidePrice: true, chaosValue: 10 },
    });

    renderWithProviders(<CardNameCell {...ctx} />);

    const link = screen.getByTestId("card-name-link");
    expect(link).toHaveClass("opacity-50");
    expect(link).toHaveClass("line-through");
  });

  it("when hidePrice is false: CardNameLink gets undefined className", () => {
    const ctx = createCellContext({
      name: "House of Mirrors",
      count: 1,
      exchangePrice: { hidePrice: false, chaosValue: 500 },
    });

    renderWithProviders(<CardNameCell {...ctx} />);

    const link = screen.getByTestId("card-name-link");
    expect(link).not.toHaveClass("opacity-50");
    expect(link).not.toHaveClass("line-through");
    expect(link).not.toHaveAttribute("class");
  });

  it("when priceInfo is undefined: hidePrice defaults to false (no line-through)", () => {
    const ctx = createCellContext({
      name: "The Nurse",
      count: 1,
      // No exchangePrice or stashPrice
    });

    renderWithProviders(<CardNameCell {...ctx} />);

    const link = screen.getByTestId("card-name-link");
    expect(link).not.toHaveClass("opacity-50");
    expect(link).not.toHaveClass("line-through");
  });

  it("renders DivinationCard with the card entry when divinationCard exists", () => {
    const original = {
      name: "The Fiend",
      count: 1,
      divinationCard: { artFilename: "fiend.png" },
    };
    const ctx = createCellContext(original);

    renderWithProviders(<CardNameCell {...ctx} />);

    const divCard = screen.getByTestId("divination-card");
    expect(divCard).toBeInTheDocument();
    expect(divCard).toHaveTextContent("The Fiend");
  });

  it("popover has popover='manual' attribute", () => {
    const ctx = createCellContext({
      name: "The Doctor",
      count: 1,
      divinationCard: { artFilename: "doctor.png" },
    });

    const { container } = renderWithProviders(<CardNameCell {...ctx} />);

    const popoverEl = container.querySelector("[popover='manual']");
    expect(popoverEl).toBeInTheDocument();
    expect(popoverEl).toHaveClass("p-0", "border-0", "bg-transparent");
  });
});
