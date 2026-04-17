import { describe, expect, it, vi } from "vitest";

vi.mock("./PFPriceCell", () => ({
  default: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createPFPriceColumn } from "./createPFPriceColumn";

describe("createPFPriceColumn", () => {
  it("returns a column with correct id", () => {
    const col = createPFPriceColumn();
    expect(col.id).toBe("divineValue");
  });

  it("returns a column with correct header", () => {
    const col = createPFPriceColumn();
    expect((col as any).header).toBe("Price");
  });

  it("returns a column with correct size", () => {
    const col = createPFPriceColumn();
    expect((col as any).size).toBe(100);
  });

  it("returns a column with enableGlobalFilter = false", () => {
    const col = createPFPriceColumn();
    expect((col as any).enableGlobalFilter).toBe(false);
  });

  it("cell renderer returns the PFPriceCell component", () => {
    const col = createPFPriceColumn();
    const cellFn = (col as any).cell;
    const mockInfo = {
      getValue: () => 1.5,
      row: {
        original: {
          cardName: "The Doctor",
          divineValue: 1.5,
        },
      },
    };
    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
