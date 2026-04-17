import { describe, expect, it, vi } from "vitest";

vi.mock("../cells", () => ({
  CardNameCell: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createCardNameColumn } from "./createCardNameColumn";

describe("createCardNameColumn", () => {
  it("returns a column with correct id", () => {
    const col = createCardNameColumn();
    expect(col.id).toBe("name");
  });

  it("cell renderer renders the cell component", () => {
    const col = createCardNameColumn();
    const cellFn = (col as any).cell;
    const mockInfo = {
      getValue: () => "The Doctor",
      row: { original: { name: "The Doctor", count: 1 } },
    };
    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
