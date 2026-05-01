import { describe, expect, it, vi } from "vitest";

vi.mock("./CurrentSessionTotalValueCell", () => ({
  default: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createCurrentSessionTotalValueColumn } from "./createCurrentSessionTotalValueColumn";

describe("createCurrentSessionTotalValueColumn", () => {
  it("returns a column with correct id", () => {
    const col = createCurrentSessionTotalValueColumn("stash");
    expect(col.id).toBe("totalValue");
  });

  it("cell renderer renders the cell component", () => {
    const col = createCurrentSessionTotalValueColumn("stash");
    const cellFn = (col as any).cell;
    const mockInfo = {
      getValue: () => 5,
      row: {
        original: {
          name: "The Doctor",
          count: 5,
          stashPrice: { chaosValue: 100, totalValue: 500 },
          exchangePrice: { chaosValue: 90, totalValue: 450 },
        },
      },
    };
    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });

  it("sorts by stash total value when price source is stash", () => {
    const col = createCurrentSessionTotalValueColumn("stash");
    const sortingFn = (col as any).sortingFn;
    const rowA = { original: { stashPrice: { totalValue: 500 } } };
    const rowB = { original: { stashPrice: { totalValue: 300 } } };

    expect(sortingFn(rowA, rowB)).toBe(200);
  });

  it("sorts by exchange total value and falls back missing prices to 0", () => {
    const col = createCurrentSessionTotalValueColumn("exchange");
    const sortingFn = (col as any).sortingFn;
    const rowA = { original: { exchangePrice: undefined } };
    const rowB = { original: { exchangePrice: { totalValue: 450 } } };

    expect(sortingFn(rowA, rowB)).toBe(-450);
  });
});
