import { describe, expect, it, vi } from "vitest";

vi.mock("./CurrentSessionRatioCell", () => ({
  default: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createCurrentSessionRatioColumn } from "./createCurrentSessionRatioColumn";

describe("createCurrentSessionRatioColumn", () => {
  it("returns a column with correct id", () => {
    const col = createCurrentSessionRatioColumn();
    expect(col.id).toBe("ratio");
  });

  it("cell renderer renders the cell component", () => {
    const col = createCurrentSessionRatioColumn();
    const cellFn = (col as any).cell;
    const mockInfo = {
      getValue: () => 5,
      row: {
        original: {
          name: "The Doctor",
          count: 5,
        },
      },
    };
    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
