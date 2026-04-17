import { describe, expect, it, vi } from "vitest";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";

vi.mock("./PFPlAllDropsCell", () => ({
  default: (_props: any) => <div data-testid="pf-pl-all-drops-cell" />,
}));

import { createPFPlAllDropsColumn } from "./createPFPlAllDropsColumn";

describe("createPFPlAllDropsColumn", () => {
  it("returns a column with correct id", () => {
    const col = createPFPlAllDropsColumn();
    expect(col.id).toBe("plB");
  });

  it("returns a column with correct size", () => {
    const col = createPFPlAllDropsColumn();
    expect((col as any).size).toBe(120);
  });

  it("returns a column with enableGlobalFilter = false", () => {
    const col = createPFPlAllDropsColumn();
    expect((col as any).enableGlobalFilter).toBe(false);
  });

  it("cell renderer returns the PFPlAllDropsCell component", () => {
    const col = createPFPlAllDropsColumn();
    const cellFn = (col as any).cell;

    const mockInfo = {
      getValue: () => 1.5,
      row: {
        original: {
          cardName: "The Doctor",
          plB: 1.5,
        } as CardForecastRow,
      },
    };

    const result = cellFn(mockInfo);
    expect(result).toBeTruthy();
  });
});
