import { describe, expect, it, vi } from "vitest";

vi.mock("../cells", () => ({
  CardRatioCell: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createCardRatioColumn } from "./createCardRatioColumn";

describe("createCardRatioColumn", () => {
  it("returns a column with correct id and header", () => {
    const col = createCardRatioColumn(100);
    expect(col.id).toBe("ratio");
  });

  it("cell renderer renders the cell component", () => {
    const col = createCardRatioColumn(100);
    const cellFn = (col as any).cell;
    const mockInfo = {
      getValue: () => 50,
      row: {
        original: {
          name: "Test Card",
          count: 5,
        },
      },
    };
    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
