import { describe, expect, it } from "vitest";

import {
  formatExpectedDrops,
  roundedExpectedDrops,
} from "./DropTimelineTooltip.utils";

describe("DropTimelineTooltip utils", () => {
  it("formats expected drops with rounding, clamping, and finite guards", () => {
    expect(formatExpectedDrops(2.4)).toBe("2");
    expect(formatExpectedDrops(1234.6)).toBe("1,235");
    expect(formatExpectedDrops(-4)).toBe("0");
    expect(formatExpectedDrops(Number.NaN)).toBe("0");
    expect(formatExpectedDrops(Number.POSITIVE_INFINITY)).toBe("0");
  });

  it("rounds expected drops with the same finite guards used by tooltip comparisons", () => {
    expect(roundedExpectedDrops(2.5)).toBe(3);
    expect(roundedExpectedDrops(-1)).toBe(0);
    expect(roundedExpectedDrops(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
