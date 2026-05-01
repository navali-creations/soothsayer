import { describe, expect, it } from "vitest";

import { BRUSH_HEIGHT, CHART_HEIGHT } from "./constants";

describe("CardDetailsPriceChart constants", () => {
  it("exports the expected chart dimensions", () => {
    expect(CHART_HEIGHT).toBe(320);
    expect(BRUSH_HEIGHT).toBe(40);
  });
});
