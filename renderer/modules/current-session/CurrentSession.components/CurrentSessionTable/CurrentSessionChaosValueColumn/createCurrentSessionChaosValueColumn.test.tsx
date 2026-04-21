import { describe, expect, it, vi } from "vitest";

vi.mock("./CurrentSessionChaosValueCell", () => ({
  default: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createCurrentSessionChaosValueColumn } from "./createCurrentSessionChaosValueColumn";

describe("createCurrentSessionChaosValueColumn", () => {
  it("returns a column with correct id", () => {
    const col = createCurrentSessionChaosValueColumn("stash");
    expect(col.id).toBe("chaosValue");
  });

  it("cell renderer renders the cell component", () => {
    const col = createCurrentSessionChaosValueColumn("stash");
    const cellFn = (col as any).cell;
    const mockInfo = {
      getValue: () => 5,
      row: {
        original: {
          name: "TestCard",
          count: 5,
          stashPrice: { chaosValue: 10, totalValue: 50 },
          exchangePrice: { chaosValue: 12, totalValue: 60 },
        },
      },
    };
    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });

  it("renders the column header", () => {
    const col = createCurrentSessionChaosValueColumn("exchange");
    const Header = (col as any).header;

    const result = Header();

    expect(result).toBeTruthy();
  });

  it("sorts by stash chaos value and falls back to zero", () => {
    const col = createCurrentSessionChaosValueColumn("stash");
    const sortingFn = (col as any).sortingFn;

    const rowA = { original: { stashPrice: { chaosValue: 25 } } };
    const rowB = { original: { stashPrice: undefined } };

    expect(sortingFn(rowA, rowB)).toBe(25);
  });

  it("sorts by stash chaos value when the first row is missing a price", () => {
    const col = createCurrentSessionChaosValueColumn("stash");
    const sortingFn = (col as any).sortingFn;

    const rowA = { original: { stashPrice: undefined } };
    const rowB = { original: { stashPrice: { chaosValue: 7 } } };

    expect(sortingFn(rowA, rowB)).toBe(-7);
  });

  it("sorts by stash chaos value when chaosValue is null", () => {
    const col = createCurrentSessionChaosValueColumn("stash");
    const sortingFn = (col as any).sortingFn;

    const rowA = { original: { stashPrice: { chaosValue: null } } };
    const rowB = { original: { stashPrice: { chaosValue: 4 } } };

    expect(sortingFn(rowA, rowB)).toBe(-4);
  });

  it("sorts by exchange chaos value and falls back to zero", () => {
    const col = createCurrentSessionChaosValueColumn("exchange");
    const sortingFn = (col as any).sortingFn;

    const rowA = { original: { exchangePrice: undefined } };
    const rowB = { original: { exchangePrice: { chaosValue: 12 } } };

    expect(sortingFn(rowA, rowB)).toBe(-12);
  });

  it("sorts by exchange chaos value when the second row is missing a price", () => {
    const col = createCurrentSessionChaosValueColumn("exchange");
    const sortingFn = (col as any).sortingFn;

    const rowA = { original: { exchangePrice: { chaosValue: 9 } } };
    const rowB = { original: { exchangePrice: undefined } };

    expect(sortingFn(rowA, rowB)).toBe(9);
  });

  it("sorts by exchange chaos value when chaosValue is null", () => {
    const col = createCurrentSessionChaosValueColumn("exchange");
    const sortingFn = (col as any).sortingFn;

    const rowA = { original: { exchangePrice: { chaosValue: 6 } } };
    const rowB = { original: { exchangePrice: { chaosValue: null } } };

    expect(sortingFn(rowA, rowB)).toBe(6);
  });
});
