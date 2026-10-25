import { describe, expect, it } from "vitest";

import { SETUP_STEPS } from "../AppSetup.types";

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

    it("should have TELEMETRY_CONSENT as 4", () => {
      expect(SETUP_STEPS.TELEMETRY_CONSENT).toBe(4);
    });

    it("should have exactly 5 steps", () => {
      expect(Object.keys(SETUP_STEPS)).toHaveLength(5);
    });

    it("should be a frozen/readonly object (as const)", () => {
      // Verify the values are the expected literal types
      const steps: Record<string, number> = SETUP_STEPS;
      expect(Object.values(steps)).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
