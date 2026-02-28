import { describe, expect, it } from "vitest";

import { formatTickingTimer } from "../useTickingTimer";

describe("formatTickingTimer", () => {
  it("formats hours, minutes, and seconds", () => {
    expect(formatTickingTimer({ hours: 5, minutes: 59, seconds: 42 })).toBe(
      "5h 59m 42s",
    );
  });

  it("zero-pads minutes and seconds when hours > 0", () => {
    expect(formatTickingTimer({ hours: 1, minutes: 3, seconds: 7 })).toBe(
      "1h 03m 07s",
    );
  });

  it("omits hours when 0", () => {
    expect(formatTickingTimer({ hours: 0, minutes: 12, seconds: 5 })).toBe(
      "12m 05s",
    );
  });

  it("handles all zeros", () => {
    expect(formatTickingTimer({ hours: 0, minutes: 0, seconds: 0 })).toBe(
      "0m 00s",
    );
  });

  it("zero-pads seconds when under a minute", () => {
    expect(formatTickingTimer({ hours: 0, minutes: 0, seconds: 8 })).toBe(
      "0m 08s",
    );
  });

  it("does not zero-pad minutes when hours are 0", () => {
    expect(formatTickingTimer({ hours: 0, minutes: 5, seconds: 30 })).toBe(
      "5m 30s",
    );
  });
});
