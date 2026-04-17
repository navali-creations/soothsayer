import { describe, expect, it, vi } from "vitest";

vi.mock("./PFStatusCell", () => ({
  default: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createPFStatusColumn } from "./createPFStatusColumn";

describe("createPFStatusColumn", () => {
  it("returns a column with correct id", () => {
    const col = createPFStatusColumn();
    expect(col.id).toBe("status");
  });

  it("returns a column with empty header", () => {
    const col = createPFStatusColumn();
    expect((col as any).header).toBe("");
  });

  it("returns a column with correct size constraints", () => {
    const col = createPFStatusColumn();
    expect((col as any).size).toBe(30);
    expect((col as any).minSize).toBe(30);
    expect((col as any).maxSize).toBe(30);
  });

  it("returns a column with sorting disabled", () => {
    const col = createPFStatusColumn();
    expect((col as any).enableSorting).toBe(false);
  });

  it("returns a column with global filter disabled", () => {
    const col = createPFStatusColumn();
    expect((col as any).enableGlobalFilter).toBe(false);
  });

  it("cell renderer returns the cell component", () => {
    const col = createPFStatusColumn();
    const cellFn = (col as any).cell;

    const mockInfo = {
      getValue: () => undefined,
      row: {
        original: {
          cardName: "The Doctor",
          belowMinPrice: false,
        },
      },
    };

    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
