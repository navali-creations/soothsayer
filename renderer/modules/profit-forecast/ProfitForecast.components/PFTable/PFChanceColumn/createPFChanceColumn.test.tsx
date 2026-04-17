import { describe, expect, it, vi } from "vitest";

vi.mock("./PFChanceCell", () => ({
  default: (_props: any) => <div data-testid="pf-chance-cell" />,
}));

import { createPFChanceColumn } from "./createPFChanceColumn";

describe("createPFChanceColumn", () => {
  it("returns a column with correct id", () => {
    const col = createPFChanceColumn();
    expect(col.id).toBe("chanceInBatch");
  });

  it("returns a column with correct header", () => {
    const col = createPFChanceColumn();
    expect((col as any).header).toBe("% Chance");
  });

  it("returns a column with correct size", () => {
    const col = createPFChanceColumn();
    expect((col as any).size).toBe(100);
  });

  it("returns a column with enableGlobalFilter = false", () => {
    const col = createPFChanceColumn();
    expect((col as any).enableGlobalFilter).toBe(false);
  });

  it("cell renderer returns the cell component", () => {
    const col = createPFChanceColumn();
    const cellFn = (col as any).cell;

    const mockInfo = {
      getValue: () => 0.25,
      row: {
        original: {
          cardName: "The Doctor",
          chanceInBatch: 0.25,
        },
      },
    };

    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
