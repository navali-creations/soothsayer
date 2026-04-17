import { describe, expect, it, vi } from "vitest";

vi.mock("./PFExcludeCell", () => ({
  default: (_props: any) => <div data-testid="pf-exclude-cell" />,
}));

import { createPFExcludeColumn } from "./createPFExcludeColumn";

describe("createPFExcludeColumn", () => {
  it("returns a column with the expected id", () => {
    const col = createPFExcludeColumn();
    expect(col.id).toBe("exclude");
  });

  it("returns a column with enableSorting false", () => {
    const col = createPFExcludeColumn();
    expect((col as any).enableSorting).toBe(false);
  });

  it("returns a column with enableGlobalFilter false", () => {
    const col = createPFExcludeColumn();
    expect((col as any).enableGlobalFilter).toBe(false);
  });

  it("returns a column with size 50", () => {
    const col = createPFExcludeColumn();
    expect((col as any).size).toBe(50);
  });

  it("cell renderer returns the PFExcludeCell component", () => {
    const col = createPFExcludeColumn();
    const cellFn = (col as any).cell;

    const mockCellProps = {
      getValue: () => undefined,
      row: {
        original: {
          cardName: "The Doctor",
        },
      },
      column: { id: "exclude" },
      table: {},
    };

    const result = cellFn(mockCellProps);
    expect(result).toBeTruthy();
  });
});
