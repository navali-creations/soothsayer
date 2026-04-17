import { describe, expect, it, vi } from "vitest";

vi.mock("../cells", () => ({
  CardCountCell: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createCardCountColumn } from "./createCardCountColumn";

describe("createCardCountColumn", () => {
  it("returns a column with correct id", () => {
    const col = createCardCountColumn();
    expect(col.id).toBe("count");
  });

  it("cell renderer renders the CardCountCell component", () => {
    const col = createCardCountColumn();
    const cellFn = (col as any).cell;
    const mockInfo = {
      getValue: () => 5,
      row: { original: { name: "The Doctor", count: 5 } },
    };
    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
