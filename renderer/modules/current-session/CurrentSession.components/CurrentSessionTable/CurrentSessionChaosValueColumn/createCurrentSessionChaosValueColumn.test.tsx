import { describe, expect, it, vi } from "vitest";

vi.mock("./CurrentSessionChaosValueCell", () => ({
  default: (_props: any) => <div data-testid="mock-cell" />,
}));

import { createCurrentSessionChaosValueColumn } from "./createCurrentSessionChaosValueColumn";

describe("createCurrentSessionChaosValueColumn", () => {
  it("returns a column with correct id", () => {
    const col = createCurrentSessionChaosValueColumn("stash");
    expect(col.id).toBe("chaosValue");
  });

  it("cell renderer renders the cell component", () => {
    const col = createCurrentSessionChaosValueColumn("stash");
    const cellFn = (col as any).cell;
    const mockInfo = {
      getValue: () => 5,
      row: {
        original: {
          name: "TestCard",
          count: 5,
          stashPrice: { chaosValue: 10, totalValue: 50 },
          exchangePrice: { chaosValue: 12, totalValue: 60 },
        },
      },
    };
    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
