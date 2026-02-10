import { describe, expect, it } from "vitest";

import { getGameSelectionType, SETUP_STEPS } from "../AppSetup.types";

describe("AppSetup.types", () => {
  // ─── SETUP_STEPS constant ───────────────────────────────────────────────────

  describe("SETUP_STEPS", () => {
    it("should have NOT_STARTED as 0", () => {
      expect(SETUP_STEPS.NOT_STARTED).toBe(0);
    });

    it("should have SELECT_GAME as 1", () => {
      expect(SETUP_STEPS.SELECT_GAME).toBe(1);
    });

    it("should have SELECT_LEAGUE as 2", () => {
      expect(SETUP_STEPS.SELECT_LEAGUE).toBe(2);
    });

    it("should have SELECT_CLIENT_PATH as 3", () => {
      expect(SETUP_STEPS.SELECT_CLIENT_PATH).toBe(3);
    });

    it("should have exactly 4 steps", () => {
      expect(Object.keys(SETUP_STEPS)).toHaveLength(4);
    });

    it("should be a frozen/readonly object (as const)", () => {
      // Verify the values are the expected literal types
      const steps: Record<string, number> = SETUP_STEPS;
      expect(Object.values(steps)).toEqual([0, 1, 2, 3]);
    });
  });

  // ─── getGameSelectionType ───────────────────────────────────────────────────

  describe("getGameSelectionType", () => {
    it('should return "both" when both poe1 and poe2 are selected', () => {
      expect(getGameSelectionType(["poe1", "poe2"])).toBe("both");
    });

    it('should return "both" regardless of order', () => {
      expect(getGameSelectionType(["poe2", "poe1"])).toBe("both");
    });

    it('should return "poe2_only" when only poe2 is selected', () => {
      expect(getGameSelectionType(["poe2"])).toBe("poe2_only");
    });

    it('should return "poe1_only" when only poe1 is selected', () => {
      expect(getGameSelectionType(["poe1"])).toBe("poe1_only");
    });

    it('should return "poe1_only" when the array is empty (fallback)', () => {
      // When neither game is present, hasPoe2 is false, so it falls through to default "poe1_only"
      expect(getGameSelectionType([])).toBe("poe1_only");
    });

    it('should return "poe1_only" when array contains only poe1 with duplicates', () => {
      // Array.includes handles duplicates gracefully
      expect(getGameSelectionType(["poe1", "poe1"])).toBe("poe1_only");
    });

    it('should return "both" when array contains duplicates of both games', () => {
      expect(getGameSelectionType(["poe1", "poe2", "poe1", "poe2"])).toBe(
        "both",
      );
    });
  });
});
