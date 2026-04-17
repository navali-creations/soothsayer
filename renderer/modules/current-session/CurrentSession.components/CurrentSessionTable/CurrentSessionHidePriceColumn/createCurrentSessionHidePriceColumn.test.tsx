import { describe, expect, it, vi } from "vitest";

vi.mock("./CurrentSessionHidePriceCell", () => ({
  default: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createCurrentSessionHidePriceColumn } from "./createCurrentSessionHidePriceColumn";

describe("createCurrentSessionHidePriceColumn", () => {
  it("returns a column with correct id", () => {
    const col = createCurrentSessionHidePriceColumn();
    expect(col.id).toBe("hidePrice");
  });

  it("returns a column with size 50", () => {
    const col = createCurrentSessionHidePriceColumn();
    expect((col as any).size).toBe(50);
  });

  it("returns a column with sorting disabled", () => {
    const col = createCurrentSessionHidePriceColumn();
    expect((col as any).enableSorting).toBe(false);
  });

  it("cell renderer returns the cell component", () => {
    const col = createCurrentSessionHidePriceColumn();
    const cellFn = (col as any).cell;

    const mockInfo = {
      getValue: () => "TestCard",
      row: {
        original: {
          name: "TestCard",
          count: 1,
        },
      },
    };

    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
