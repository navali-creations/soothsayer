import { describe, expect, it, vi } from "vitest";

import type { DivinationCardMetadata } from "~/types/data-stores";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";
import { createPFCardNameColumn } from "./createPFCardNameColumn";

// Mock the PFCardNameCell component so we can assert on its props
vi.mock("./PFCardNameCell", () => ({
  default: (props: any) => (
    <div data-testid="pf-card-name-cell" {...props}>
      {props.cardName}
    </div>
  ),
}));

function makeCardMetadata(
  name: string,
  overrides: Partial<DivinationCardMetadata> = {},
): DivinationCardMetadata {
  return {
    name,
    stackSize: 5,
    artFilename: `${name}.png`,
    flavourText: "Some flavour",
    rewardText: "Some reward",
    rarity: 2,
    ...overrides,
  } as DivinationCardMetadata;
}

describe("createPFCardNameColumn", () => {
  it("returns a column definition with the expected id", () => {
    const col = createPFCardNameColumn(new Map());
    expect(col.id).toBe("cardName");
  });

  it("returns a column definition with the expected header", () => {
    const col = createPFCardNameColumn(new Map());
    expect((col as any).header).toBe("Card Name");
  });

  it("returns a column definition with the expected size", () => {
    const col = createPFCardNameColumn(new Map());
    expect((col as any).size).toBe(200);
  });

  it("returns a column definition with the expected minSize", () => {
    const col = createPFCardNameColumn(new Map());
    expect((col as any).minSize).toBe(150);
  });

  it("returns a column definition with meta.alignStart = true", () => {
    const col = createPFCardNameColumn(new Map());
    expect((col as any).meta).toEqual({ alignStart: true });
  });

  it("returns a column definition with enableGlobalFilter = true", () => {
    const col = createPFCardNameColumn(new Map());
    expect((col as any).enableGlobalFilter).toBe(true);
  });

  it("renders the cell function with card metadata from the map", () => {
    const metadata = makeCardMetadata("The Doctor");
    const cardMetadataMap = new Map<string, DivinationCardMetadata>([
      ["The Doctor", metadata],
    ]);

    const col = createPFCardNameColumn(cardMetadataMap);
    const cellFn = (col as any).cell;

    // Create a mock CellContext-like info object
    const mockInfo = {
      getValue: () => "The Doctor",
      row: {
        original: {
          cardName: "The Doctor",
          belowMinPrice: false,
        } as CardForecastRow,
      },
    };

    const result = cellFn(mockInfo);

    expect(result).toBeTruthy();
    expect(result.props.cardName).toBe("The Doctor");
    expect(result.props.cardMetadata).toBe(metadata);
    expect(result.props.belowMinPrice).toBe(false);
  });

  it("renders the cell function with null metadata when card is not in map", () => {
    const cardMetadataMap = new Map<string, DivinationCardMetadata>();

    const col = createPFCardNameColumn(cardMetadataMap);
    const cellFn = (col as any).cell;

    const mockInfo = {
      getValue: () => "Unknown Card",
      row: {
        original: {
          cardName: "Unknown Card",
          belowMinPrice: true,
        } as CardForecastRow,
      },
    };

    const result = cellFn(mockInfo);

    expect(result).toBeTruthy();
    expect(result.props.cardName).toBe("Unknown Card");
    expect(result.props.cardMetadata).toBeNull();
    expect(result.props.belowMinPrice).toBe(true);
  });
});
