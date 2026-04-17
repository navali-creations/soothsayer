import { describe, expect, it, vi } from "vitest";

vi.mock("./PFPlCardOnlyCell", () => ({
  default: (_props: any) => <div data-testid="pf-pl-card-only-cell" />,
}));

import { createPFPlCardOnlyColumn } from "./createPFPlCardOnlyColumn";

describe("createPFPlCardOnlyColumn", () => {
  it("returns a column with correct id", () => {
    const col = createPFPlCardOnlyColumn();
    expect(col.id).toBe("plA");
  });

  it("returns a column with correct size", () => {
    const col = createPFPlCardOnlyColumn();
    expect((col as any).size).toBe(120);
  });

  it("returns a column with enableGlobalFilter = false", () => {
    const col = createPFPlCardOnlyColumn();
    expect((col as any).enableGlobalFilter).toBe(false);
  });

  it("cell renderer returns the PFPlCardOnlyCell component", () => {
    const col = createPFPlCardOnlyColumn();
    const cellFn = (col as any).cell;

    const mockInfo = {
      getValue: () => 1.5,
      row: {
        original: {
          cardName: "The Doctor",
          plA: 1.5,
        },
      },
    };

    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
