import { describe, expect, it, vi } from "vitest";

vi.mock("./CurrentSessionChaosValueCell", () => ({
  default: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createCurrentSessionChaosValueColumn } from "./createCurrentSessionChaosValueColumn";

describe("createCurrentSessionChaosValueColumn", () => {
  it("returns a column with correct id", () => {
    const col = createCurrentSessionChaosValueColumn();
    expect(col.id).toBe("chaosValue");
  });

  it("cell renderer renders the cell component", () => {
    const col = createCurrentSessionChaosValueColumn();
    const cellFn = (col as any).cell;
    const mockInfo = {
      getValue: () => 5,
      row: {
        original: {
          name: "TestCard",
          count: 5,
          price: { chaosValue: 12, totalValue: 60 },
        },
      },
    };
    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });

  it("renders the column header", () => {
    const col = createCurrentSessionChaosValueColumn();
    const Header = (col as any).header;

    const result = Header();

    expect(result).toBeTruthy();
  });

  it("sorts by chaos value and falls back to zero", () => {
    const col = createCurrentSessionChaosValueColumn();
    const sortingFn = (col as any).sortingFn;

    const rowA = { original: { price: { chaosValue: 25 } } };
    const rowB = { original: { price: undefined } };

    expect(sortingFn(rowA, rowB)).toBe(25);
  });

  it("sorts by chaos value when the first row is missing a price", () => {
    const col = createCurrentSessionChaosValueColumn();
    const sortingFn = (col as any).sortingFn;

    const rowA = { original: { price: undefined } };
    const rowB = { original: { price: { chaosValue: 7 } } };

    expect(sortingFn(rowA, rowB)).toBe(-7);
  });

  it("sorts by chaos value when chaosValue is null", () => {
    const col = createCurrentSessionChaosValueColumn();
    const sortingFn = (col as any).sortingFn;

    const rowA = { original: { price: { chaosValue: null } } };
    const rowB = { original: { price: { chaosValue: 4 } } };

    expect(sortingFn(rowA, rowB)).toBe(-4);
  });
});
